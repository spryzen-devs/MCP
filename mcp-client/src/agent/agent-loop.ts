import { GeminiClient } from '../gemini/gemini-client.js';
import { McpClientManager } from '../mcp-client.js';
import { ToolRegistry } from './tool-registry.js';
import { Content, Part } from '@google/genai';
import { auditLogger } from '../server.js';
import { markAsUntrusted, TextExtractor, TextNormalizer, RuleBasedDetector, TextSanitizer } from '../sentinel/index.js';

export class AgentLoop {
  private gemini: GeminiClient;
  private mcpClient: McpClientManager;
  private toolRegistry: ToolRegistry;
  private maxRounds = 10;

  constructor(gemini: GeminiClient, mcpClient: McpClientManager, toolRegistry: ToolRegistry) {
    this.gemini = gemini;
    this.mcpClient = mcpClient;
    this.toolRegistry = toolRegistry;
  }

  async run(userInput: string, history: Content[] = []): Promise<Content[]> {
    console.log(`[Agent] User request received: "${userInput}"`);
    const tools = this.toolRegistry.getGeminiTools();
    
    let currentHistory: Content[] = [...history];

    currentHistory.push({
      role: 'user',
      parts: [{ text: userInput }]
    });

    for (let round = 0; round < this.maxRounds; round++) {
      console.log(`[Gemini] Sending request to model (Round ${round + 1})...`);
      
      const response = await this.gemini.client.models.generateContent({
        model: this.gemini.getModelName(),
        contents: currentHistory,
        config: {
          tools: tools.length > 0 ? tools : undefined
        }
      });

      // Append model's response to history
      if (response.candidates && response.candidates[0].content) {
        currentHistory.push(response.candidates[0].content);
      } else {
        throw new Error("No content returned from model.");
      }

      const functionCalls = response.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        console.log(`[Gemini] Final response generated.`);
        return currentHistory; // Return full updated history
      }

      const toolResponsesParts: Part[] = [];

      for (const call of functionCalls) {
        const functionName = call.name;
        
        if (!functionName) {
          console.warn('[Agent] Received function call without a name, skipping.');
          continue;
        }

        console.log(`[Gemini] Tool call requested: ${functionName}`);

        const toolInfo = this.toolRegistry.getToolInfo(functionName);

        if (!toolInfo) {
          console.log(`[Agent] Invalid tool requested: ${functionName}`);
          toolResponsesParts.push({
            functionResponse: {
              name: functionName,
              response: { error: `Tool ${functionName} not found or not permitted.` }
            }
          });
          continue;
        }

        console.log(`[Agent] Tool validated: ${toolInfo.name}`);
        console.log(`[MCP] Calling ${toolInfo.name} on server ${toolInfo.serverId} with args:`, call.args);

        try {
          const mcpResult = await this.mcpClient.callTool(toolInfo.serverId, toolInfo.name, call.args as Record<string, any>);

          // PHASE 4: Apply Untrusted Boundary
          const untrustedResult = markAsUntrusted(mcpResult, toolInfo.serverId, toolInfo.name);

          // PHASE 7: Detection Pipeline
          const extracted = TextExtractor.extract(untrustedResult);
          const normalized = TextNormalizer.normalizeAll(extracted);
          const findings = RuleBasedDetector.detect(normalized);
          
          // PHASE 8: Sanitization
          const sanitizedResult = TextSanitizer.sanitize(untrustedResult, findings);

          if (findings.length > 0) {
            console.log(`[SENTINEL] Indirect Prompt Injection Detected! Found ${findings.length} finding(s). Spans have been sanitized.`);
            auditLogger.record('INDIRECT_PROMPT_INJECTION_DETECTED', toolInfo.serverId, toolInfo.name, { findings, removedSpans: sanitizedResult.removedSpans });
          }

          if (sanitizedResult.isError) {
            console.log(`[MCP] Tool returned an error.`);
            const errText = sanitizedResult.sanitizedContent.content?.map((c: any) => c.text).join(' ') || String(sanitizedResult.sanitizedContent.error || sanitizedResult.sanitizedContent);
            toolResponsesParts.push({
              functionResponse: {
                name: functionName,
                response: { error: errText }
              }
            });
          } else {
            console.log(`[MCP] Tool executed successfully.`);
            toolResponsesParts.push({
              functionResponse: {
                name: functionName,
                // STEP 20: Pass sanitized representation to LLM
                response: sanitizedResult.sanitizedContent
              }
            });
          }
        } catch (error: any) {
          console.error(`[Agent] Tool execution or security processing failed:`, error);
          toolResponsesParts.push({
            functionResponse: {
              name: functionName,
              response: { error: `Execution or security processing failed: ${error.message}` }
            }
          });
        }
      }

      console.log(`[Gemini] Sending tool result(s) back to model...`);
      currentHistory.push({
        role: 'user', // Wait, functionResponses typically go as role 'user' or as 'function' depending on SDK version. In @google/genai, it's typically user or model. Let's use user.
        parts: toolResponsesParts
      });
    }

    throw new Error(`Agent exceeded maximum number of rounds (${this.maxRounds}).`);
  }
}
