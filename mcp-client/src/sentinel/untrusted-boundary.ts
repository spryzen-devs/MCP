import { UntrustedMCPResult } from './types.js';

/**
 * PHASE 4: Untrusted Boundary
 * Explicitly marks an MCP tool result as untrusted before it enters the security pipeline.
 * Does not mutate the original result; merely wraps it with provenance and trust metadata.
 */
export function markAsUntrusted(
  mcpResult: any,
  serverId: string,
  toolName: string
): UntrustedMCPResult {
  return {
    trust: 'UNTRUSTED',
    source: 'MCP_TOOL_RESULT',
    serverId,
    toolName,
    isError: !!mcpResult?.isError,
    originalContent: mcpResult
  };
}
