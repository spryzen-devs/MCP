// ─── Trust Lifecycle ───────────────────────────────────────────────

export type TrustStatus =
  | 'discovered'
  | 'pending_approval'
  | 'trusted'
  | 'suspended'
  | 'mutation_detected'
  | 'code_mutation_detected';

// ─── Tool Manifest ─────────────────────────────────────────────────

export interface ToolManifest {
  server: string;
  tool: string;
  name: string;
  description: string;
  inputSchema: unknown;
}

// ─── Diff Types ────────────────────────────────────────────────────

export interface ManifestDiff {
  path: string;
  type: 'added' | 'removed' | 'changed';
  previous?: unknown;
  current?: unknown;
}

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

// ─── Trust Registry ────────────────────────────────────────────────

export interface ToolBaseline {
  toolName: string;
  manifestHash: string;
  canonicalManifest: ToolManifest;
  approvedAt: string;
  approvedBy: string;
  previousHashes: string[];
}

export interface ServerRegistryEntry {
  serverId: string;
  serverName: string;
  serverHash?: string;
  codeHash?: string;
  status: TrustStatus;
  tools: Record<string, ToolBaseline>;
  currentManifests: Record<string, ToolManifest>;
  aiContext?: any;
  approvedAt?: string;
  lastVerified?: string;
  lastMutation?: string;
  approvedUpdateCount: number;
}

export interface TrustRegistryData {
  servers: Record<string, ServerRegistryEntry>;
}

// ─── Integrity Results ─────────────────────────────────────────────

export type IntegrityAction = 'pin' | 'verify' | 'suspend' | 'reapprove';

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
  action: IntegrityAction;
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

// ─── Execution Gate ────────────────────────────────────────────────

export type ExecutionBlockReason = 'suspended' | 'unknown' | 'pending_approval';

export interface ExecutionDecision {
  allowed: boolean;
  server: string;
  tool: string;
  reason: ExecutionBlockReason | 'trusted';
}

// ─── Cross-Server Detection ───────────────────────────────────────

export interface CrossServerWarning {
  severity: 'high' | 'medium' | 'low';
  sourceServer: string;
  sourceTool: string;
  referencedTarget: string;
  suspiciousBehavior: string;
  matchedPattern: string;
}

// ─── Audit Log ─────────────────────────────────────────────────────

export type AuditEventType =
  | 'SERVER_DISCOVERED'
  | 'SERVER_APPROVED'
  | 'MANIFEST_VERIFIED'
  | 'MANIFEST_MUTATION_DETECTED'
  | 'CODE_MUTATION_DETECTED'
  | 'TOOL_SUSPENDED'
  | 'UPDATE_REVIEWED'
  | 'UPDATE_APPROVED'
  | 'UPDATE_REJECTED'
  | 'TRUST_BASELINE_UPDATED'
  | 'CROSS_SERVER_WARNING'
  | 'SIMULATION_STARTED'
  | 'SIMULATION_RESET'
  | 'SECURITY_ANALYSIS_STARTED'
  | 'STATIC_ANALYSIS_COMPLETED'
  | 'OLLAMA_ANALYSIS_COMPLETED'
  | 'SECURITY_REVIEW_REQUIRED'
  | 'INDIRECT_PROMPT_INJECTION_DETECTED';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: AuditEventType;
  server: string;
  tool?: string;
  details?: Record<string, unknown>;
}

// ─── Attack Simulation ─────────────────────────────────────────────

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

// ─── Untrusted Boundary ─────────────────────────────────────────────

export interface UntrustedMCPResult {
  trust: 'UNTRUSTED';
  source: 'MCP_TOOL_RESULT';
  serverId: string;
  toolName: string;
  isError: boolean;
  originalContent: any;
}

// ─── Text Extraction ────────────────────────────────────────────────

export interface ExtractedText {
  text: string;
  serverId: string;
  toolName: string;
  source: string;
  path: string;
  blockIndex?: number;
}

// ─── Normalization ──────────────────────────────────────────────────

export interface NormalizedText {
  originalText: string;
  normalizedText: string;
  serverId: string;
  toolName: string;
  source: string;
  path: string;
  blockIndex?: number;
}

// ─── Detection ──────────────────────────────────────────────────────

export type ThreatCategory = 
  | 'instruction_override' 
  | 'role_impersonation' 
  | 'sensitive_data_exfiltration' 
  | 'unauthorized_action' 
  | 'security_bypass' 
  | 'external_reference';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Indicator {
  category: ThreatCategory;
  ruleId: string;
  matchedText: string;
  confidenceContribution: number;
  location: string;
}

export interface InjectionFinding {
  threatType: 'INDIRECT_PROMPT_INJECTION';
  severity: RiskSeverity;
  serverId: string;
  toolName: string;
  source: string;
  path: string;
  indicators: Indicator[];
  reason: string;
  blockIndex?: number;
}

// ─── Sanitization ───────────────────────────────────────────────────

export interface RemovedSpanAudit {
  ruleId: string;
  category: string;
  path: string;
  blockIndex?: number;
  removedTextLength: number;
  replacementMarker: string;
}

export interface SanitizationResult {
  trust: 'SANITIZED';
  source: string;
  serverId: string;
  toolName: string;
  isError: boolean;
  originalContent: any;
  sanitizedContent: any;
  isQuarantined: boolean;
  removedSpans: RemovedSpanAudit[];
}

