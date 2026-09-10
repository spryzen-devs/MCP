import { GeminiClient } from '../gemini/gemini-client.js';
import { McpClientManager } from '../mcp-client.js';
import { ToolRegistry } from './tool-registry.js';
import { Content, Part } from '@google/genai';
import { auditLogger } from '../server.js';
import { IndirectInjectionDetector, UntrustedToolResult } from '../sentinel/indirect-injection-detector.js';

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

        const mcpResult = await this.mcpClient.callTool(toolInfo.serverId, toolInfo.name, call.args as Record<string, any>);

        if (mcpResult.isError) {
          console.log(`[MCP] Tool returned an error.`);
          const errText = mcpResult.content.map((c: any) => c.text).join(' ');
          toolResponsesParts.push({
            functionResponse: {
              name: functionName,
              response: { error: errText }
            }
          });
        } else {
          console.log(`[MCP] Result received.`);
          const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
          
          // PHASE 6: Establish Untrusted Data Boundary
          const untrustedData: UntrustedToolResult = {
            provenance: 'tool_result/untrusted',
            serverId: toolInfo.serverId,
            toolName: toolInfo.name,
            content: resultText
          };

          // PHASE 3: Run Indirect Prompt Injection Detection
          const detection = IndirectInjectionDetector.analyze(
            untrustedData.toolName, 
            untrustedData.serverId, 
            untrustedData.content
          );

          if (detection.hasInjection) {
            console.warn(`[SENTINEL] INDIRECT PROMPT INJECTION DETECTED in ${toolInfo.serverId} -> ${toolInfo.name}`);
            
            // PHASE 5: Log findings
            for (const finding of detection.findings) {
              console.warn(`\n--------------------------------------------------`);
              console.warn(`⚠ INDIRECT PROMPT INJECTION DETECTED`);
              console.warn(`Source:   ${finding.source}`);
              console.warn(`Category: ${finding.category}`);
              console.warn(`Evidence: ${finding.evidence}`);
              console.warn(`Risk:     ${finding.risk}`);
              console.warn(`Reason:   ${finding.reason}`);
              console.warn(`Decision: ${finding.decision}`);
              console.warn(`--------------------------------------------------\n`);

              auditLogger.record('INDIRECT_PROMPT_INJECTION_DETECTED', toolInfo.serverId, toolInfo.name, finding as unknown as Record<string, unknown>);
            }

            // Block the payload from reaching the agent
            toolResponsesParts.push({
              functionResponse: {
                name: functionName,
                response: { error: `Security policy blocked this tool response due to suspicious instruction injection (Risk: HIGH).` }
              }
            });
          } else {
            toolResponsesParts.push({
              functionResponse: {
                name: functionName,
                response: { result: resultText }
              }
            });
          }
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
