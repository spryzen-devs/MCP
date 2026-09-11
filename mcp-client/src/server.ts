import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { McpClientManager } from './mcp-client.js';
import { config } from './config.js';
import {
  TrustRegistry,
  ManifestVerifier,
  AuditLogger,
  AttackSimulator,
  StaticAnalyzer,
  ATTACK_SCENARIOS,
  IndirectInjectionDetector
} from './sentinel/index.js';
import { llmAnalyzer } from './sentinel/llm-analyzer.js';
import { CodeVerifier } from './sentinel/code-verifier.js';
import type { AttackScenarioId, ServerVerificationResult } from './sentinel/types.js';



// ─── Setup ──────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// ─── Core Instances ─────────────────────────────────────────────

const mcpClient = new McpClientManager();
const registryPath = resolve(__dirname, '../data/trust-registry.json');
const trustRegistry = new TrustRegistry(registryPath);
const verifier = new ManifestVerifier(trustRegistry);
export const auditLogger = new AuditLogger();
const attackSimulator = new AttackSimulator();

// ─── Startup: Reset calculator & email so first connection triggers full analysis ──
// This ensures the live dashboard shows code extraction + LLM analysis on first connect.
// Subsequent connects within the same session will use hash comparison for mutation detection.
const RESET_ON_STARTUP = ['calculator', 'email'];
for (const sid of RESET_ON_STARTUP) {
  trustRegistry.clearServer(sid);
}
console.log(`[SENTINEL] Trust registry cleared for [${RESET_ON_STARTUP.join(', ')}] — fresh analysis on first connect.`);

// Helper to asynchronously fetch AI insights
async function enrichWithAIInsights(serverId: string, serverName: string, verification: ServerVerificationResult) {
  if (verification.overallStatus === 'mutation_detected') {
    for (const tool of verification.toolResults) {
      if (tool.action === 'suspend' && tool.diff) {
        try {
          const baseline = trustRegistry.getToolBaseline(serverId, tool.tool);
          const current = trustRegistry.getServer(serverId)?.currentManifests[tool.tool];
          
          if (baseline && current) {
            const insight = await llmAnalyzer.analyzeManifestDiff(
              serverName, 
              tool.tool, 
              baseline.canonicalManifest, 
              current, 
              tool.diff
            );
            tool.aiInsights = insight;
          }
        } catch (e) {
          console.error('[SENTINEL] Failed to fetch AI insights:', e);
        }
      }
    }
  }
  return verification;
}

// ─── Server State ───────────────────────────────────────────────

interface ServerState {
  connected: boolean;
  tools: string[];
  fullManifests: Array<{ name: string; description?: string; inputSchema?: unknown }>;
}

const serversState: Record<string, ServerState> = {
  calculator: { connected: false, tools: [], fullManifests: [] },
  email: { connected: false, tools: [], fullManifests: [] },
  calculatormcp2: { connected: false, tools: [], fullManifests: [] },
  documentsearch: { connected: false, tools: [], fullManifests: [] },
};

const SERVER_NAMES: Record<string, string> = {
  calculator: 'Calculator MCP',
  email: 'Email MCP',
  calculatormcp2: 'CalculatorMCP2 (Adversarial)',
  documentsearch: 'Document Search (Injection)'
};

function getAllServerIds(): string[] {
  return Object.keys(serversState);
}

function getAllServerNames(): string[] {
  return Object.values(SERVER_NAMES);
}

// ─── MCP Status Endpoint ────────────────────────────────────────

app.get('/api/mcp/status', (_req, res) => {
  res.json({ servers: serversState });
});

// ─── Helper: Connect Server ─────────────────────────────────────

export const pendingCodeMutations: Record<string, any> = {};
export const pendingSecurityReviews: Record<string, any> = {};

async function connectServer(serverId: string, path: string) {
  if (!serversState[serverId].connected) {
    console.log(`[MCP] Checking code for ${serverId}...`);
    const currentHash = CodeVerifier.getCodeHash(path);
    const baselineHash = trustRegistry.getServerCodeHash(serverId);
    
    let sourcePath = path;
    const distMatch = path.match(/(\/|\\)dist(\/|\\)/);
    if (distMatch) {
      const maybeTsPath = path.replace(distMatch[0], distMatch[1] + 'src' + distMatch[2]).replace(/\.js$/, '.ts');
      if (fs.existsSync(maybeTsPath)) {
        sourcePath = maybeTsPath;
      }
    }
    const newCode = CodeVerifier.getCodeContent(sourcePath);

    if (!baselineHash) {
      // First time connection: untrusted server. Must undergo security review.
      console.log(`[MCP] New untrusted server detected. Connecting to extract manifest for analysis...`);
      await mcpClient.connect(serverId, path);
      const fullManifests = await mcpClient.getFullToolManifests(serverId);
      
      console.log(`[SENTINEL] Running security analysis on untrusted server: ${serverId}`);
      auditLogger.record('SECURITY_ANALYSIS_STARTED', serverId);
      
      const staticFindings = StaticAnalyzer.analyze(newCode);
      auditLogger.record('STATIC_ANALYSIS_COMPLETED', serverId);
      
      const manifestStr = JSON.stringify(fullManifests, null, 2);
      const aiReview = await llmAnalyzer.analyzeUntrustedServer(serverId, newCode, staticFindings, manifestStr);
      auditLogger.record('OLLAMA_ANALYSIS_COMPLETED', serverId);
      
      auditLogger.record('SECURITY_REVIEW_REQUIRED', serverId);
      
      pendingSecurityReviews[serverId] = { staticFindings, aiReview, fingerprint: currentHash, rawTools: fullManifests };
      
      // Close connection since it's not approved yet
      await mcpClient.close(serverId);
      throw new Error('SECURITY_REVIEW_REQUIRED');
    } else if (currentHash !== baselineHash) {
      // Code mutation detected!
      console.log(`[MCP] CODE MUTATION DETECTED for ${serverId}!`);
      const oldCode = CodeVerifier.getTrustedCode(serverId);
      
      const insight = await llmAnalyzer.analyzeCodeMutation(serverId, oldCode, newCode);
      
      trustRegistry.updateServerStatus(serverId, 'code_mutation_detected', currentHash);
      auditLogger.record('CODE_MUTATION_DETECTED', serverId);
      
      pendingCodeMutations[serverId] = { oldCode, newCode, insight };
      throw new Error('CODE_MUTATION_DETECTED');
    }

    console.log(`[MCP] Connecting to ${serverId}...`);
    await mcpClient.connect(serverId, path);
    console.log(`[MCP] MCP connection established for ${serverId}`);

    const fullManifests = await mcpClient.getFullToolManifests(serverId);
    serversState[serverId].fullManifests = fullManifests;
    serversState[serverId].tools = fullManifests.map(t => t.name);
    serversState[serverId].connected = true;

    // Capture originals for attack simulator
    attackSimulator.captureOriginals(serverId, fullManifests);

    // Register with sentinel
    trustRegistry.registerServer(serverId, SERVER_NAMES[serverId]);
    auditLogger.record('SERVER_DISCOVERED', serverId);

    console.log(`[MCP] tools/list completed for ${serverId} (${fullManifests.length} tools)`);
  }
}

// ─── Helper: Disconnect Server ──────────────────────────────────

async function disconnectServer(serverId: string) {
  if (serversState[serverId].connected) {
    console.log(`[MCP] Disconnecting ${serverId}...`);
    await mcpClient.close(serverId);
    serversState[serverId].connected = false;
    serversState[serverId].tools = [];
    serversState[serverId].fullManifests = [];
    console.log(`[MCP] MCP connection closed for ${serverId}`);
  }
}

// ─── Helper: Connect Server Stream ────────────────────────────────

async function connectServerStream(serverId: string, path: string, res: any) {
  if (serversState[serverId].connected) {
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    res.end();
    return;
  }
  
  const sendEvent = (type: string, payload: any) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  console.log(`[MCP] Checking code for ${serverId} (Stream)...`);
  const currentHash = CodeVerifier.getCodeHash(path);
  const baselineHash = trustRegistry.getServerCodeHash(serverId);
  
  let sourcePath = path;
  const distMatch = path.match(/(\/|\\)dist(\/|\\)/);
  if (distMatch) {
    const maybeTsPath = path.replace(distMatch[0], distMatch[1] + 'src' + distMatch[2]).replace(/\.js$/, '.ts');
    if (fs.existsSync(maybeTsPath)) {
      sourcePath = maybeTsPath;
    }
  }
  const newCode = CodeVerifier.getCodeContent(sourcePath);

  if (!baselineHash) {
    sendEvent('code_extracted', { code: newCode });
    await mcpClient.connect(serverId, path);
    const fullManifests = await mcpClient.getFullToolManifests(serverId);
    
    sendEvent('analysis_started', {});
    const staticFindings = StaticAnalyzer.analyze(newCode);
    
    const manifestStr = JSON.stringify(fullManifests, null, 2);
    
    sendEvent('llm_started', { staticFindings });
    
    const aiReview = await llmAnalyzer.analyzeUntrustedServer(
      serverId, 
      newCode, 
      staticFindings, 
      manifestStr,
      (chunk) => sendEvent('llm_chunk', { chunk })
    );
    
    pendingSecurityReviews[serverId] = { staticFindings, aiReview, fingerprint: currentHash, rawTools: fullManifests };
    
    // Keep server connected so the approve endpoint can work
    serversState[serverId].fullManifests = fullManifests;
    serversState[serverId].tools = fullManifests.map(t => t.name);
    serversState[serverId].connected = true;
    trustRegistry.registerServer(serverId, SERVER_NAMES[serverId]);
    
    sendEvent('review_complete', { reviewData: pendingSecurityReviews[serverId] });
    res.end();
  } else if (currentHash !== baselineHash) {
    const oldCode = CodeVerifier.getTrustedCode(serverId);
    sendEvent('code_mutation_detected', { oldCode, newCode });
    sendEvent('llm_started', {});
    
    const insight = await llmAnalyzer.analyzeCodeMutation(
      serverId, oldCode, newCode, 
      trustRegistry.getServerContext(serverId),
      (chunk) => sendEvent('llm_chunk', { chunk })
    );
    
    trustRegistry.updateServerStatus(serverId, 'code_mutation_detected', currentHash);
    pendingCodeMutations[serverId] = { oldCode, newCode, insight };
    
    sendEvent('mutation_complete', { mutationData: pendingCodeMutations[serverId] });
    res.end();
  } else {
    await mcpClient.connect(serverId, path);
    const fullManifests = await mcpClient.getFullToolManifests(serverId);
    serversState[serverId].fullManifests = fullManifests;
    serversState[serverId].tools = fullManifests.map(t => t.name);
    serversState[serverId].connected = true;
    attackSimulator.captureOriginals(serverId, fullManifests);
    trustRegistry.registerServer(serverId, SERVER_NAMES[serverId]);
    sendEvent('connected', {});
    res.end();
  }
}

// ─── Connect Endpoints ──────────────────────────────────────────

app.get('/api/mcp/:serverId/connect-stream', async (req, res) => {
  const serverId = req.params.serverId;
  let path = '';
  if (serverId === 'calculator') path = config.calculatorServerPath;
  else if (serverId === 'email') path = config.emailServerPath;
  else if (serverId === 'calculatormcp2') path = config.calculatorMCP2ServerPath;
  else if (serverId === 'documentsearch') path = config.documentSearchServerPath;
  
  if (!path) {
    return res.status(404).json({ error: 'Unknown server' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    await connectServerStream(serverId, path, res);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', payload: err.message })}\n\n`);
    res.end();
  }
});

app.post('/api/mcp/calculator/connect', async (_req, res) => {
  try {
    await connectServer('calculator', config.calculatorServerPath);
  } catch (error: any) {
    if (error.message === 'CODE_MUTATION_DETECTED') {
      return res.json({
        success: false,
        connected: false,
        codeMutation: true,
        mutationData: pendingCodeMutations['calculator']
      });
    }
    if (error.message === 'SECURITY_REVIEW_REQUIRED') {
      return res.json({
        success: false,
        connected: false,
        securityReviewRequired: true,
        reviewData: pendingSecurityReviews['calculator']
      });
    }
    throw error;
  }
  
  try {

    // Verify manifests through sentinel
    let verification = verifier.verifyServer(
      'calculator',
      SERVER_NAMES['calculator'],
      serversState.calculator.fullManifests,
      getAllServerIds(),
      getAllServerNames()
    );

    // Enrich with AI insights if there are mutations
    verification = await enrichWithAIInsights('calculator', SERVER_NAMES['calculator'], verification);

    // Record audit events based on verification results
    for (const toolResult of verification.toolResults) {
      if (toolResult.action === 'verify') {
        auditLogger.record('MANIFEST_VERIFIED', 'calculator', toolResult.tool);
      } else if (toolResult.action === 'suspend') {
        auditLogger.record('MANIFEST_MUTATION_DETECTED', 'calculator', toolResult.tool, {
          baselineHash: toolResult.baselineHash,
          currentHash: toolResult.currentHash,
          categories: toolResult.mutationCategories
        });
        auditLogger.record('TOOL_SUSPENDED', 'calculator', toolResult.tool);
      }

      if (toolResult.crossServerWarnings && toolResult.crossServerWarnings.length > 0) {
        auditLogger.record('CROSS_SERVER_WARNING', 'calculator', toolResult.tool, {
          warnings: toolResult.crossServerWarnings
        });
      }
    }

    res.json({
      success: true,
      ...serversState.calculator,
      sentinel: verification
    });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/email/connect', async (_req, res) => {
  try {
    await connectServer('email', config.emailServerPath);
  } catch (error: any) {
    if (error.message === 'CODE_MUTATION_DETECTED') {
      return res.json({
        success: false,
        connected: false,
        codeMutation: true,
        mutationData: pendingCodeMutations['email']
      });
    }
    if (error.message === 'SECURITY_REVIEW_REQUIRED') {
      return res.json({
        success: false,
        connected: false,
        securityReviewRequired: true,
        reviewData: pendingSecurityReviews['email']
      });
    }
    throw error;
  }
  
  try {

    let verification = verifier.verifyServer(
      'email',
      SERVER_NAMES['email'],
      serversState.email.fullManifests,
      getAllServerIds(),
      getAllServerNames()
    );

    // Enrich with AI insights if there are mutations
    verification = await enrichWithAIInsights('email', SERVER_NAMES['email'], verification);

    // Record audit events based on verification results
    for (const toolResult of verification.toolResults) {
      if (toolResult.action === 'verify') {
        auditLogger.record('MANIFEST_VERIFIED', 'email', toolResult.tool);
      } else if (toolResult.action === 'suspend') {
        auditLogger.record('MANIFEST_MUTATION_DETECTED', 'email', toolResult.tool, {
          baselineHash: toolResult.baselineHash,
          currentHash: toolResult.currentHash,
          categories: toolResult.mutationCategories
        });
        auditLogger.record('TOOL_SUSPENDED', 'email', toolResult.tool);
      }

      if (toolResult.crossServerWarnings && toolResult.crossServerWarnings.length > 0) {
        auditLogger.record('CROSS_SERVER_WARNING', 'email', toolResult.tool, {
          warnings: toolResult.crossServerWarnings
        });
      }
    }

    res.json({
      success: true,
      ...serversState.email,
      sentinel: verification
    });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/calculatormcp2/connect', async (_req, res) => {
  try {
    await connectServer('calculatormcp2', config.calculatorMCP2ServerPath);
  } catch (error: any) {
    if (error.message === 'CODE_MUTATION_DETECTED') {
      return res.json({
        success: false,
        connected: false,
        codeMutation: true,
        mutationData: pendingCodeMutations['calculatormcp2']
      });
    }
    if (error.message === 'SECURITY_REVIEW_REQUIRED') {
      return res.json({
        success: false,
        connected: false,
        securityReviewRequired: true,
        reviewData: pendingSecurityReviews['calculatormcp2']
      });
    }
    throw error;
  }
  
  try {
    let verification = verifier.verifyServer(
      'calculatormcp2',
      SERVER_NAMES['calculatormcp2'],
      serversState.calculatormcp2.fullManifests,
      getAllServerIds(),
      getAllServerNames()
    );

    verification = await enrichWithAIInsights('calculatormcp2', SERVER_NAMES['calculatormcp2'], verification);

    for (const toolResult of verification.toolResults) {
      if (toolResult.action === 'verify') {
        auditLogger.record('MANIFEST_VERIFIED', 'calculatormcp2', toolResult.tool);
      } else if (toolResult.action === 'suspend') {
        auditLogger.record('MANIFEST_MUTATION_DETECTED', 'calculatormcp2', toolResult.tool, {
          baselineHash: toolResult.baselineHash,
          currentHash: toolResult.currentHash,
          categories: toolResult.mutationCategories
        });
        auditLogger.record('TOOL_SUSPENDED', 'calculatormcp2', toolResult.tool);
      }

      if (toolResult.crossServerWarnings && toolResult.crossServerWarnings.length > 0) {
        auditLogger.record('CROSS_SERVER_WARNING', 'calculatormcp2', toolResult.tool, {
          warnings: toolResult.crossServerWarnings
        });
      }
    }

    res.json({
      success: true,
      ...serversState.calculatormcp2,
      sentinel: verification
    });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/documentsearch/connect', async (_req, res) => {
  try {
    await connectServer('documentsearch', config.documentSearchServerPath);
  } catch (error: any) {
    if (error.message === 'CODE_MUTATION_DETECTED') {
      return res.json({
        success: false,
        connected: false,
        codeMutation: true,
        mutationData: pendingCodeMutations['documentsearch']
      });
    }
    if (error.message === 'SECURITY_REVIEW_REQUIRED') {
      return res.json({
        success: false,
        connected: false,
        securityReviewRequired: true,
        reviewData: pendingSecurityReviews['documentsearch']
      });
    }
    throw error;
  }
  
  try {
    let verification = verifier.verifyServer(
      'documentsearch',
      SERVER_NAMES['documentsearch'],
      serversState.documentsearch.fullManifests,
      getAllServerIds(),
      getAllServerNames()
    );

    verification = await enrichWithAIInsights('documentsearch', SERVER_NAMES['documentsearch'], verification);

    for (const toolResult of verification.toolResults) {
      if (toolResult.action === 'verify') {
        auditLogger.record('MANIFEST_VERIFIED', 'documentsearch', toolResult.tool);
      } else if (toolResult.action === 'suspend') {
        auditLogger.record('MANIFEST_MUTATION_DETECTED', 'documentsearch', toolResult.tool, {
          baselineHash: toolResult.baselineHash,
          currentHash: toolResult.currentHash,
          categories: toolResult.mutationCategories
        });
        auditLogger.record('TOOL_SUSPENDED', 'documentsearch', toolResult.tool);
      }

      if (toolResult.crossServerWarnings && toolResult.crossServerWarnings.length > 0) {
        auditLogger.record('CROSS_SERVER_WARNING', 'documentsearch', toolResult.tool, {
          warnings: toolResult.crossServerWarnings
        });
      }
    }

    res.json({
      success: true,
      ...serversState.documentsearch,
      sentinel: verification
    });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Disconnect Endpoints ───────────────────────────────────────

app.post('/api/mcp/calculator/disconnect', async (_req, res) => {
  try {
    await disconnectServer('calculator');
    res.json({ success: true, connected: false });
  } catch (error: any) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/email/disconnect', async (_req, res) => {
  try {
    await disconnectServer('email');
    res.json({ success: true, connected: false });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect.' });
  }
});

app.post('/api/mcp/calculatormcp2/disconnect', async (_req, res) => {
  try {
    await disconnectServer('calculatormcp2');
    res.json({ success: true, connected: false });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect.' });
  }
});

app.post('/api/mcp/documentsearch/disconnect', async (_req, res) => {
  try {
    await disconnectServer('documentsearch');
    res.json({ success: true, connected: false });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect.' });
  }
});

app.post('/api/mcp/clear-registry', (req, res) => {
  trustRegistry.clearAll();
  CodeVerifier.saveTrustedCode('calculator', config.calculatorServerPath);
  CodeVerifier.saveTrustedCode('email', config.emailServerPath);
  res.json({ success: true });
});

app.post('/api/mcp/:serverId/approve-code', (req, res) => {
  const { serverId } = req.params;
  const serverPath = serverId === 'calculator' ? config.calculatorServerPath : serverId === 'email' ? config.emailServerPath : config.calculatorMCP2ServerPath;
  const currentHash = CodeVerifier.getCodeHash(serverPath);
  
  CodeVerifier.saveTrustedCode(serverId, serverPath);
  trustRegistry.updateServerCodeBaseline(serverId, currentHash);
  trustRegistry.updateServerStatus(serverId, 'trusted', currentHash);
  auditLogger.record('TRUST_BASELINE_UPDATED', serverId);
  delete pendingCodeMutations[serverId];
  
  res.json({ success: true });
});

// ─── Calculate Endpoint (with Sentinel Gate) ────────────────────

app.post('/api/mcp/calculator/calculate', async (req, res) => {
  try {
    const { expression } = req.body;

    if (!expression || typeof expression !== 'string') {
      return res.status(400).json({ success: false, tool: 'calculator.evaluate', error: 'Expression must be a non-empty string' });
    }

    console.log(`[API] Calculator request received: "${expression}"`);

    if (!serversState.calculator.connected) {
      return res.status(400).json({ success: false, tool: 'calculator.evaluate', error: 'Calculator MCP server is not connected. Please connect it first.' });
    }

    // SENTINEL GATE: Check if tool execution is allowed
    if (!verifier.canExecute('calculator', 'calculator.evaluate')) {
      const server = trustRegistry.getServer('calculator');
      console.log(`[SENTINEL] Execution BLOCKED for calculator.evaluate (status: ${server?.status})`);
      return res.status(403).json({
        success: false,
        tool: 'calculator.evaluate',
        error: 'Tool execution blocked by Sentinel. The tool manifest integrity has not been verified or the tool is suspended.',
        sentinelStatus: server?.status || 'unknown'
      });
    }

    console.log(`[MCP] Calling calculator.evaluate`);
    const mcpResult = await mcpClient.callTool('calculator', 'calculator.evaluate', { expression });

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      console.log(`[MCP] Tool error: ${errText}`);
      return res.json({ success: false, tool: 'calculator.evaluate', expression, error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    console.log(`[MCP] Result received: ${resultText}`);
    return res.json({ success: true, tool: 'calculator.evaluate', expression, result: resultText });

  } catch (error: any) {
    console.error('Calculate error:', error);
    res.status(500).json({ success: false, tool: 'calculator.evaluate', error: error.message });
  }
});

// ─── Email Endpoints (with Sentinel Gate) ───────────────────────

app.post('/api/mcp/email/send', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, tool: 'email.send', error: 'to, subject, and body are required' });
    }

    if (!serversState.email.connected) {
      return res.status(400).json({ success: false, tool: 'email.send', error: 'Email MCP server is not connected.' });
    }

    // SENTINEL GATE
    if (!verifier.canExecute('email', 'email.send')) {
      return res.status(403).json({
        success: false,
        tool: 'email.send',
        error: 'Tool execution blocked by Sentinel.',
        sentinelStatus: trustRegistry.getServer('email')?.status || 'unknown'
      });
    }

    const mcpResult = await mcpClient.callTool('email', 'email.send', { to, subject, body });

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      return res.json({ success: false, tool: 'email.send', error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    return res.json({ success: true, tool: 'email.send', result: resultText });

  } catch (error: any) {
    res.status(500).json({ success: false, tool: 'email.send', error: error.message });
  }
});

app.post('/api/mcp/email/read', async (_req, res) => {
  try {
    if (!serversState.email.connected) {
      return res.status(400).json({ success: false, tool: 'email.read', error: 'Email MCP server is not connected.' });
    }

    // SENTINEL GATE
    if (!verifier.canExecute('email', 'email.read')) {
      return res.status(403).json({
        success: false,
        tool: 'email.read',
        error: 'Tool execution blocked by Sentinel.',
        sentinelStatus: trustRegistry.getServer('email')?.status || 'unknown'
      });
    }

    const mcpResult = await mcpClient.callTool('email', 'email.read', {});

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      return res.json({ success: false, tool: 'email.read', error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    return res.json({ success: true, tool: 'email.read', result: resultText });

  } catch (error: any) {
    res.status(500).json({ success: false, tool: 'email.read', error: error.message });
  }
});

// ─── Document Search Endpoint (with Sentinel Gate & Injection Detector) ──

app.post('/api/mcp/documentsearch/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, tool: 'search_documents', error: 'Query is required' });
    }

    console.log(`[API] Document search request received: "${query}"`);

    if (!serversState.documentsearch.connected) {
      return res.status(400).json({ success: false, tool: 'search_documents', error: 'Document Search MCP server is not connected. Please connect it first.' });
    }

    // SENTINEL GATE: Check if tool execution is allowed
    if (!verifier.canExecute('documentsearch', 'search_documents')) {
      const server = trustRegistry.getServer('documentsearch');
      console.log(`[SENTINEL] Execution BLOCKED for search_documents (status: ${server?.status})`);
      return res.status(403).json({
        success: false,
        tool: 'search_documents',
        error: 'Tool execution blocked by Sentinel. The tool manifest integrity has not been verified or the tool is suspended.',
        sentinelStatus: server?.status || 'unknown'
      });
    }

    console.log(`[MCP] Calling search_documents`);
    const mcpResult = await mcpClient.callTool('documentsearch', 'search_documents', { query });

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      console.log(`[MCP] Tool error: ${errText}`);
      return res.json({ success: false, tool: 'search_documents', query, error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    
    // SENTINEL GATE: Check for Indirect Prompt Injection
    const detection = IndirectInjectionDetector.analyze('search_documents', 'documentsearch', resultText);
    
    if (detection.hasInjection) {
      console.warn(`[SENTINEL] INDIRECT PROMPT INJECTION DETECTED in documentsearch -> search_documents`);
      
      for (const finding of detection.findings) {
        auditLogger.record('INDIRECT_PROMPT_INJECTION_DETECTED', 'documentsearch', 'search_documents', finding as unknown as Record<string, unknown>);
      }
      
      return res.json({ 
        success: false, 
        tool: 'search_documents', 
        query, 
        error: 'Security policy blocked this tool response due to suspicious instruction injection (Risk: HIGH).',
        injectionBlocked: true
      });
    }

    console.log(`[MCP] Result received: ${resultText}`);
    return res.json({ success: true, tool: 'search_documents', query, result: resultText });

  } catch (error: any) {
    console.error('Document Search error:', error);
    res.status(500).json({ success: false, tool: 'search_documents', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// SENTINEL API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// ─── Trust Registry Status ──────────────────────────────────────

app.get('/api/sentinel/status', (_req, res) => {
  const registry = trustRegistry.getSnapshot();
  const activeScenario = attackSimulator.getActiveScenario();
  res.json({ registry, activeScenario });
});

// ─── Approve Server (Initial Trust) ─────────────────────────────

app.post('/api/sentinel/server/:id/approve', (req, res) => {
  try {
    const serverId = req.params.id;
    const state = serversState[serverId];

    if (!state || !state.connected) {
      return res.status(400).json({ success: false, error: `Server ${serverId} is not connected.` });
    }

    verifier.approveServer(serverId, state.fullManifests);
    auditLogger.record('SERVER_APPROVED', serverId, undefined, {
      toolCount: state.fullManifests.length,
      tools: state.tools
    });

    // Save initial AI context for future mutation analysis
    const pendingReview = pendingSecurityReviews[serverId];
    if (pendingReview && pendingReview.aiReview) {
      trustRegistry.setServerContext(serverId, pendingReview.aiReview);
    }

    // Save trusted code baseline + hash so subsequent connections use mutation detection
    const serverPath = serverId === 'calculator' ? config.calculatorServerPath 
      : serverId === 'email' ? config.emailServerPath 
      : serverId === 'calculatormcp2' ? config.calculatorMCP2ServerPath 
      : serverId === 'documentsearch' ? config.documentSearchServerPath 
      : null;
    
    if (serverPath) {
      const currentHash = CodeVerifier.getCodeHash(serverPath);
      CodeVerifier.saveTrustedCode(serverId, serverPath);
      trustRegistry.updateServerCodeBaseline(serverId, currentHash);
      console.log(`[SENTINEL] Saved trusted code baseline for ${serverId} (hash: ${currentHash.substring(0, 12)}...)`);
    }

    // Clear pending review since it's been handled
    delete pendingSecurityReviews[serverId];

    console.log(`[SENTINEL] Server ${serverId} APPROVED with ${state.fullManifests.length} tools`);

    res.json({
      success: true,
      registry: trustRegistry.getSnapshot()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Approve Tool Update (Re-approval) ─────────────────────────

app.post('/api/sentinel/server/:id/tool/:tool/approve', (req, res) => {
  try {
    const { id: serverId, tool: toolName } = req.params;

    verifier.reapproveTool(serverId, toolName);
    auditLogger.record('UPDATE_APPROVED', serverId, toolName);
    auditLogger.record('TRUST_BASELINE_UPDATED', serverId, toolName);

    console.log(`[SENTINEL] Tool ${toolName} on ${serverId} RE-APPROVED`);

    res.json({
      success: true,
      registry: trustRegistry.getSnapshot()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Reject Tool Update ─────────────────────────────────────────

app.post('/api/sentinel/server/:id/tool/:tool/reject', (req, res) => {
  try {
    const { id: serverId, tool: toolName } = req.params;

    auditLogger.record('UPDATE_REJECTED', serverId, toolName);

    console.log(`[SENTINEL] Update for ${toolName} on ${serverId} REJECTED`);

    res.json({
      success: true,
      message: 'Update rejected. Tool remains suspended.',
      registry: trustRegistry.getSnapshot()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Re-verify Server ───────────────────────────────────────────

app.post('/api/sentinel/server/:id/reverify', async (req, res) => {
  try {
    const serverId = req.params.id;
    const state = serversState[serverId];

    if (!state || !state.connected) {
      return res.status(400).json({ success: false, error: `Server ${serverId} is not connected.` });
    }

    // Use simulated manifests if a simulation is active
    const activeScenario = attackSimulator.getActiveScenario();
    let manifests = state.fullManifests;

    if (activeScenario && activeScenario !== 'CLEAN') {
      const simulated = attackSimulator.activate(activeScenario);
      if (simulated) {
        manifests = simulated;
        console.log(`[SENTINEL] Re-verifying with SIMULATED manifests (scenario: ${activeScenario})`);
      }
    }

    let verification = verifier.verifyServer(
      serverId,
      SERVER_NAMES[serverId],
      manifests,
      getAllServerIds(),
      getAllServerNames()
    );

    // Enrich with AI insights if there are mutations
    verification = await enrichWithAIInsights(serverId, SERVER_NAMES[serverId], verification);

    // Record audit events based on verification results
    for (const toolResult of verification.toolResults) {
      if (toolResult.action === 'verify') {
        auditLogger.record('MANIFEST_VERIFIED', serverId, toolResult.tool);
      } else if (toolResult.action === 'suspend') {
        auditLogger.record('MANIFEST_MUTATION_DETECTED', serverId, toolResult.tool, {
          baselineHash: toolResult.baselineHash,
          currentHash: toolResult.currentHash,
          categories: toolResult.mutationCategories
        });
        auditLogger.record('TOOL_SUSPENDED', serverId, toolResult.tool);
      }

      if (toolResult.crossServerWarnings && toolResult.crossServerWarnings.length > 0) {
        auditLogger.record('CROSS_SERVER_WARNING', serverId, toolResult.tool, {
          warnings: toolResult.crossServerWarnings
        });
      }
    }

    res.json({
      success: true,
      verification,
      registry: trustRegistry.getSnapshot()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Audit Log ──────────────────────────────────────────────────

app.get('/api/sentinel/audit-log', (_req, res) => {
  res.json({ entries: auditLogger.getAll() });
});

// ─── Attack Simulation ──────────────────────────────────────────

app.get('/api/sentinel/scenarios', (_req, res) => {
  res.json({ scenarios: ATTACK_SCENARIOS });
});

app.post('/api/sentinel/simulate/:scenario', (req, res) => {
  try {
    const scenarioId = req.params.scenario as AttackScenarioId;
    const scenario = ATTACK_SCENARIOS.find(s => s.id === scenarioId);

    if (!scenario) {
      return res.status(400).json({ success: false, error: `Unknown scenario: ${scenarioId}` });
    }

    if (!attackSimulator.hasOriginals('calculator')) {
      return res.status(400).json({
        success: false,
        error: 'Calculator server must be connected first to capture original manifests.'
      });
    }

    const simulatedManifests = attackSimulator.activate(scenarioId);
    auditLogger.record('SIMULATION_STARTED', scenario.targetServer, undefined, {
      scenario: scenarioId,
      name: scenario.name
    });

    console.log(`[SENTINEL] Attack simulation activated: ${scenario.name}`);

    // Re-verify with simulated manifests
    if (simulatedManifests) {
      const verification = verifier.verifyServer(
        scenario.targetServer,
        SERVER_NAMES[scenario.targetServer],
        simulatedManifests,
        getAllServerIds(),
        getAllServerNames()
      );

      // Record audit events
      for (const toolResult of verification.toolResults) {
        if (toolResult.action === 'suspend') {
          auditLogger.record('MANIFEST_MUTATION_DETECTED', scenario.targetServer, toolResult.tool, {
            simulation: true,
            categories: toolResult.mutationCategories
          });
          auditLogger.record('TOOL_SUSPENDED', scenario.targetServer, toolResult.tool);
        }
        if (toolResult.crossServerWarnings && toolResult.crossServerWarnings.length > 0) {
          auditLogger.record('CROSS_SERVER_WARNING', scenario.targetServer, toolResult.tool, {
            warnings: toolResult.crossServerWarnings
          });
        }
      }

      res.json({
        success: true,
        scenario,
        verification,
        simulatedManifests,
        registry: trustRegistry.getSnapshot()
      });
    } else {
      res.json({ success: true, scenario, message: 'Scenario activated but no manifests generated.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sentinel/simulate/reset', (_req, res) => {
  try {
    attackSimulator.reset();

    // Clear and re-register servers, then re-verify with clean manifests
    for (const serverId of getAllServerIds()) {
      trustRegistry.clearServer(serverId);

      if (serversState[serverId].connected) {
        trustRegistry.registerServer(serverId, SERVER_NAMES[serverId]);
      }
    }

    auditLogger.record('SIMULATION_RESET', 'all');
    auditLogger.clear();

    console.log(`[SENTINEL] Simulation reset. Trust registry cleared.`);

    res.json({
      success: true,
      message: 'Simulation reset. All trust baselines cleared. Please re-approve servers.',
      registry: trustRegistry.getSnapshot()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Start the server ───────────────────────────────────────────

app.listen(port, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  MCP SENTINEL GATEWAY                    ║`);
  console.log(`║  Backend API: http://localhost:${port}       ║`);
  console.log(`║  Trust Registry: ${registryPath}  ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});

// Clean shutdown
process.on('uncaughtException', (err) => {
  console.error('\n[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
  console.log("\nShutting down Sentinel Gateway...");
  await mcpClient.closeAll();
  process.exit(0);
});
