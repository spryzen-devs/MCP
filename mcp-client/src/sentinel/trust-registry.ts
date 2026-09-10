import fs from 'node:fs';
import type {
  TrustRegistryData,
  ServerRegistryEntry,
  ToolBaseline,
  ToolManifest,
  TrustStatus
} from './types.js';

/**
 * Persistent Trust Registry.
 * 
 * Stores approved baselines for all servers and their tools.
 * The MCP server can NEVER update its own trusted fingerprint.
 * Only explicit administrator approval can establish/update trust.
 */
export class TrustRegistry {
  private data: TrustRegistryData = { servers: {} };
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  // ─── Persistence ──────────────────────────────────────────────

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.data = { servers: {} };
      return;
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    try {
      this.data = JSON.parse(raw);
    } catch {
      // Refuse to start on corrupted data to prevent auto-pinning attacks
      throw new Error(`FATAL: Trust registry at ${this.filePath} is corrupted. Refusing to start.`);
    }
  }


  private persist(): void {
    // Ensure directory exists
    const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Direct write (OneDrive blocks atomic rename)
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // ─── Server Operations ────────────────────────────────────────

  getServer(serverId: string): ServerRegistryEntry | undefined {
    return this.data.servers[serverId];
  }

  getServerCodeHash(serverId: string): string | undefined {
    return this.data.servers[serverId]?.codeHash;
  }

  getAllServers(): Record<string, ServerRegistryEntry> {
    return structuredClone(this.data.servers);
  }

  registerServer(serverId: string, serverName: string): ServerRegistryEntry {
    if (!this.data.servers[serverId]) {
      this.data.servers[serverId] = {
        serverId,
        serverName,
        status: 'discovered',
        tools: {},
        currentManifests: {},
        approvedUpdateCount: 0
      };
      this.persist();
    }
    return this.data.servers[serverId];
  }

  updateServerStatus(serverId: string, status: TrustStatus, serverHash?: string): void {
    const server = this.data.servers[serverId];
    if (server) {
      server.status = status;
      if (serverHash) {
        server.serverHash = serverHash;
      }
      if (status === 'mutation_detected' || status === 'code_mutation_detected') {
        server.lastMutation = new Date().toISOString();
      }
      if (status === 'trusted') {
        server.lastVerified = new Date().toISOString();
      }
      this.persist();
    }
  }

  updateServerCodeBaseline(serverId: string, codeHash: string): void {
    const server = this.data.servers[serverId];
    if (server) {
      server.codeHash = codeHash;
      this.persist();
    }
  }

  setServerContext(serverId: string, aiContext: any): void {
    const server = this.data.servers[serverId];
    if (server) {
      server.aiContext = aiContext;
      this.persist();
    }
  }

  getServerContext(serverId: string): any | undefined {
    return this.data.servers[serverId]?.aiContext;
  }

  // ─── Tool Operations ──────────────────────────────────────────

  getToolBaseline(serverId: string, toolName: string): ToolBaseline | undefined {
    return this.data.servers[serverId]?.tools[toolName];
  }

  hasToolBaseline(serverId: string, toolName: string): boolean {
    return !!this.data.servers[serverId]?.tools[toolName];
  }

  /**
   * Establishes or updates a trusted baseline for a tool.
   * Only called during explicit administrator approval.
   */
  setToolBaseline(
    serverId: string,
    toolName: string,
    manifestHash: string,
    manifest: ToolManifest,
    approvedBy: string = 'admin'
  ): void {
    const server = this.data.servers[serverId];
    if (!server) return;

    const existing = server.tools[toolName];
    const previousHashes = existing
      ? [...existing.previousHashes, existing.manifestHash]
      : [];

    server.tools[toolName] = {
      toolName,
      manifestHash,
      canonicalManifest: structuredClone(manifest),
      approvedAt: new Date().toISOString(),
      approvedBy,
      previousHashes
    };

    if (existing) {
      server.approvedUpdateCount++;
    }

    this.persist();
  }

  /**
   * Stores the current (unverified) manifest received from the server.
   * This is separate from the trusted baseline.
   */
  setCurrentManifest(serverId: string, toolName: string, manifest: ToolManifest): void {
    const server = this.data.servers[serverId];
    if (server) {
      server.currentManifests[toolName] = structuredClone(manifest);
      // Do NOT persist current manifests; they are ephemeral
    }
  }

  /**
   * Approve the server — set its status and approval timestamp.
   */
  approveServer(serverId: string): void {
    const server = this.data.servers[serverId];
    if (server) {
      server.status = 'trusted';
      server.approvedAt = new Date().toISOString();
      server.lastVerified = new Date().toISOString();
      this.persist();
    }
  }

  /**
   * Returns the list of tool names currently registered for a server.
   */
  getToolNames(serverId: string): string[] {
    const server = this.data.servers[serverId];
    return server ? Object.keys(server.tools) : [];
  }

  /**
   * Resets the registry — used for testing / simulation reset.
   */
  clearServer(serverId: string): void {
    delete this.data.servers[serverId];
    this.persist();
  }

  clearAll(): void {
    this.data = { servers: {} };
    this.persist();
  }

  /**
   * Returns a snapshot of the full registry for API responses.
   */
  getSnapshot(): TrustRegistryData {
    return structuredClone(this.data);
  }
}
