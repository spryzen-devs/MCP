export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  toolsUsed?: ToolExecutionState[];
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  enabledMcpServerIds: string[];
  backendHistory?: any[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: any;
}

export interface McpServer {
  id: string;
  name: string;
  status: ConnectionStatus;
  tools: McpTool[];
  lastUsed?: number;
  type: 'local' | 'remote';
  command?: string; // for local
  endpoint?: string; // for remote
}

export type ToolExecutionStatus = 'running' | 'completed' | 'failed';

export interface ToolExecutionState {
  id: string;
  serverName: string;
  toolName: string;
  status: ToolExecutionStatus;
  arguments: any;
  result?: any;
  error?: string;
}

// ─── Sentinel Security Types ────────────────────────────────────

export type TrustStatus = 'discovered' | 'pending_approval' | 'trusted' | 'suspended' | 'mutation_detected';

export type MutationCategory =
  | 'DESCRIPTION_CHANGED'
  | 'SCHEMA_CHANGED'
  | 'TOOL_ADDED'
  | 'TOOL_REMOVED'
  | 'PARAMETER_ADDED'
  | 'PARAMETER_REMOVED'
  | 'PARAMETER_TYPE_CHANGED'
  | 'REQUIRED_CHANGED'
  | 'ENUM_CHANGED'
  | 'NAME_CHANGED'
  | 'METADATA_CHANGED';

export interface ManifestDiff {
  path: string;
  type: 'added' | 'removed' | 'changed';
  previous?: unknown;
  current?: unknown;
}

export interface CrossServerWarning {
  severity: 'high' | 'medium' | 'low';
  sourceServer: string;
  sourceTool: string;
  referencedTarget: string;
  suspiciousBehavior: string;
  matchedPattern: string;
}

export interface ToolBaseline {
  toolName: string;
  manifestHash: string;
  canonicalManifest: any;
  approvedAt: string;
  approvedBy: string;
  previousHashes: string[];
}

export interface ServerRegistryEntry {
  serverId: string;
  serverName: string;
  serverHash?: string;
  status: TrustStatus;
  tools: Record<string, ToolBaseline>;
  currentManifests: Record<string, any>;
  approvedAt?: string;
  lastVerified?: string;
  lastMutation?: string;
  approvedUpdateCount: number;
}

export interface TrustRegistryData {
  servers: Record<string, ServerRegistryEntry>;
}

export interface AIInsight {
  summary: string;
  isDataLossRisk: boolean;
  isDataTheftRisk: boolean;
  rawResponse: string;
}

export interface ToolIntegrityResult {
  server: string;
  tool: string;
  status: TrustStatus;
  action: string;
  currentHash: string;
  baselineHash?: string;
  diff?: ManifestDiff[];
  mutationCategories?: MutationCategory[];
  crossServerWarnings?: CrossServerWarning[];
  aiInsights?: AIInsight;
}

export interface ServerVerificationResult {
  serverId: string;
  serverName: string;
  serverHash: string;
  overallStatus: TrustStatus;
  toolResults: ToolIntegrityResult[];
  crossServerWarnings: CrossServerWarning[];
}

export type AuditEventType =
  | 'SERVER_DISCOVERED'
  | 'SERVER_APPROVED'
  | 'MANIFEST_VERIFIED'
  | 'MANIFEST_MUTATION_DETECTED'
  | 'TOOL_SUSPENDED'
  | 'UPDATE_REVIEWED'
  | 'UPDATE_APPROVED'
  | 'UPDATE_REJECTED'
  | 'TRUST_BASELINE_UPDATED'
  | 'CROSS_SERVER_WARNING'
  | 'SIMULATION_STARTED'
  | 'SIMULATION_RESET';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: AuditEventType;
  server: string;
  tool?: string;
  details?: Record<string, unknown>;
}

export type AttackScenarioId =
  | 'CLEAN'
  | 'DESCRIPTION_MUTATION'
  | 'CROSS_SERVER_HIJACK'
  | 'SCHEMA_MUTATION'
  | 'TOOL_ADDED'
  | 'TOOL_REMOVED'
  | 'LEGITIMATE_UPDATE';

export interface AttackScenario {
  id: AttackScenarioId;
  name: string;
  description: string;
  targetServer: string;
  severity: 'info' | 'warning' | 'critical';
}
