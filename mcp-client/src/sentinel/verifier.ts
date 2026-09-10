import { hashManifest, hashServerManifests, toToolManifest } from './canonicalizer.js';
import { diffManifests, categorizeMutations } from './diff-engine.js';
import { TrustRegistry } from './trust-registry.js';
import { detectCrossServerInstructions } from './cross-server-detector.js';
import type {
  ToolManifest,
  ToolIntegrityResult,
  ServerVerificationResult,
  TrustStatus,
  CrossServerWarning,
  MutationCategory,
  ManifestDiff
} from './types.js';

/**
 * Manifest Integrity Verifier.
 * 
 * Verifies tool manifests against trusted baselines.
 * Operates at the server level — verifies all tools when a server connects/reconnects.
 */
export class ManifestVerifier {
  private registry: TrustRegistry;

  constructor(registry: TrustRegistry) {
    this.registry = registry;
  }

  /**
   * Verifies all tools from a server against their trusted baselines.
   * Called on every connect/reconnect.
   * 
   * @param serverId Server identifier
   * @param serverName Human-readable server name
   * @param rawTools Array of raw MCP tool objects from tools/list
   * @param allServerIds All known server IDs (for cross-server detection)
   * @param allServerNames All known server names (for cross-server detection)
   */
  verifyServer(
    serverId: string,
    serverName: string,
    rawTools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
    allServerIds: string[] = [],
    allServerNames: string[] = []
  ): ServerVerificationResult {
    // Ensure server is registered
    this.registry.registerServer(serverId, serverName);

    const typedManifests = rawTools.map(t => toToolManifest(serverName, t));
    const serverHash = hashServerManifests(typedManifests);

    const toolResults: ToolIntegrityResult[] = [];
    const allCrossServerWarnings: CrossServerWarning[] = [];
    let overallStatus: TrustStatus = 'trusted';

    // Check for removed tools (tools in baseline but not in current)
    const currentToolNames = new Set(rawTools.map(t => t.name));
    const baselineToolNames = this.registry.getToolNames(serverId);

    for (const baselineTool of baselineToolNames) {
      if (!currentToolNames.has(baselineTool)) {
        toolResults.push({
          server: serverId,
          tool: baselineTool,
          status: 'suspended',
          action: 'suspend',
          currentHash: '',
          baselineHash: this.registry.getToolBaseline(serverId, baselineTool)?.manifestHash,
          mutationCategories: ['TOOL_REMOVED']
        });
        overallStatus = 'mutation_detected';
      }
    }

    // Verify each current tool
    for (const rawTool of rawTools) {
      const manifest = toToolManifest(serverId, rawTool);
      const result = this.verifySingleTool(serverId, manifest);

      // Store current manifest for display
      this.registry.setCurrentManifest(serverId, rawTool.name, manifest);

      // Cross-server detection
      const crossWarnings = detectCrossServerInstructions(
        serverId,
        rawTool.name,
        rawTool.description || '',
        allServerIds.filter(id => id !== serverId),
        allServerNames.filter(n => n.toLowerCase() !== serverName.toLowerCase())
      );

      if (crossWarnings.length > 0) {
        result.crossServerWarnings = crossWarnings;
        allCrossServerWarnings.push(...crossWarnings);
      }

      // Check for newly added tools (not in baseline)
      if (result.action === 'pin') {
        // New tool — if server was already trusted, this is a TOOL_ADDED mutation
        const serverEntry = this.registry.getServer(serverId);
        if (serverEntry && serverEntry.approvedAt) {
          result.mutationCategories = ['TOOL_ADDED'];
          result.status = 'suspended';
          result.action = 'suspend';
          overallStatus = 'mutation_detected';
        }
      }

      if (result.status === 'suspended' || result.status === 'mutation_detected') {
        overallStatus = 'mutation_detected';
      }

      toolResults.push(result);
    }

    // Update server-level status
    const serverEntry = this.registry.getServer(serverId);
    if (!serverEntry?.approvedAt) {
      // Server has never been approved
      overallStatus = 'pending_approval';
    }

    this.registry.updateServerStatus(serverId, overallStatus, serverHash);

    const result: ServerVerificationResult = {
      serverId,
      serverName,
      serverHash,
      overallStatus,
      toolResults,
      crossServerWarnings: allCrossServerWarnings
    };

    return result;
  }

  /**
   * Verifies a single tool manifest against its baseline.
   */
  private verifySingleTool(serverId: string, manifest: ToolManifest): ToolIntegrityResult {
    const currentHash = hashManifest(manifest);
    const baseline = this.registry.getToolBaseline(serverId, manifest.tool);

    // First observation — pin
    if (!baseline) {
      return {
        server: serverId,
        tool: manifest.tool,
        status: 'pending_approval',
        action: 'pin',
        currentHash
      };
    }

    // Hash match — verified
    if (baseline.manifestHash === currentHash) {
      return {
        server: serverId,
        tool: manifest.tool,
        status: 'trusted',
        action: 'verify',
        currentHash,
        baselineHash: baseline.manifestHash
      };
    }

    // Hash mismatch — suspend
    const diff = diffManifests(baseline.canonicalManifest, manifest);
    const categories = categorizeMutations(diff);

    return {
      server: serverId,
      tool: manifest.tool,
      status: 'suspended',
      action: 'suspend',
      currentHash,
      baselineHash: baseline.manifestHash,
      diff,
      mutationCategories: categories
    };
  }

  /**
   * Approves a server and pins all its current tool manifests as trusted baselines.
   * Called during initial approval.
   */
  approveServer(
    serverId: string,
    rawTools: Array<{ name: string; description?: string; inputSchema?: unknown }>
  ): void {
    for (const rawTool of rawTools) {
      const manifest = toToolManifest(serverId, rawTool);
      const hash = hashManifest(manifest);
      this.registry.setToolBaseline(serverId, rawTool.name, hash, manifest);
    }
    this.registry.approveServer(serverId);
  }

  /**
   * Re-approves a specific tool — establishes a new baseline from its current manifest.
   */
  reapproveTool(serverId: string, toolName: string): void {
    const server = this.registry.getServer(serverId);
    if (!server) return;

    const currentManifest = server.currentManifests[toolName];
    if (!currentManifest) return;

    const hash = hashManifest(currentManifest);
    this.registry.setToolBaseline(serverId, toolName, hash, currentManifest);

    // Check if all tools are now trusted
    const allTrusted = Object.keys(server.currentManifests).every(t => {
      const baseline = this.registry.getToolBaseline(serverId, t);
      if (!baseline) return false;
      const manifest = server.currentManifests[t];
      return baseline.manifestHash === hashManifest(manifest);
    });

    if (allTrusted) {
      this.registry.updateServerStatus(serverId, 'trusted');
    }
  }

  /**
   * Checks if a specific tool is allowed to execute.
   */
  canExecute(serverId: string, toolName: string): boolean {
    const server = this.registry.getServer(serverId);
    if (!server) return false;
    if (server.status !== 'trusted') return false;

    const baseline = this.registry.getToolBaseline(serverId, toolName);
    if (!baseline) return false;

    return true;
  }
}
