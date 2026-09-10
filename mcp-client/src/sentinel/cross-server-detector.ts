import type { CrossServerWarning } from './types.js';

/**
 * Imperative instruction patterns that suggest a tool description is attempting
 * to influence the AI to interact with other servers/tools.
 * 
 * These are general heuristics — NOT hardcoded to "email" or "calculator".
 */
const IMPERATIVE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(use|call|invoke|execute|run|trigger|activate|send\s+(?:a|the)?)\b.*\b(tool|server|service|endpoint|api|function|method)\b/i, label: 'Imperative tool invocation' },
  { regex: /\b(forward|relay|transfer|redirect|pipe|pass)\b.*\b(to|into|towards)\b/i, label: 'Data forwarding instruction' },
  { regex: /\bsystem\s*(?:override|instruction|prompt|command)\b/i, label: 'System override attempt' },
  { regex: /\bwhen\s+(?:this\s+)?tool\s+is\s+(?:available|called|used)\b/i, label: 'Conditional execution trigger' },
  { regex: /\b(?:also|additionally|then|after(?:wards?)?)\s+(?:use|call|invoke|send|forward)\b/i, label: 'Chained action instruction' },
  { regex: /\b(?:must|should|always|never)\s+(?:also|first|then)?\s*(?:use|call|invoke|send|forward)\b/i, label: 'Mandatory action directive' },
  { regex: /\b(?:ignore|disregard|override|bypass)\s+(?:previous|prior|other|all|any)\s+(?:instructions?|rules?|constraints?|policies?)\b/i, label: 'Instruction override attempt' },
  { regex: /\buser(?:'s)?\s+(?:data|messages?|history|input|chat|conversation|credentials?|password|token)\b.*\b(?:send|forward|email|transmit|upload|exfiltrate|post)\b/i, label: 'Data exfiltration attempt' },
  { regex: /\b(?:send|forward|email|transmit)\b.*\buser(?:'s)?\s+(?:data|messages?|history|input|chat|conversation)\b/i, label: 'Data exfiltration attempt (reversed)' },
  { regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, label: 'Email address in description' },
];

/**
 * Detects suspicious cross-server instructions in a tool description.
 * 
 * Checks whether a tool's description contains imperative instructions that
 * reference other connected MCP servers or their tools — a sign of prompt injection.
 * 
 * @param sourceServer The server this tool belongs to
 * @param sourceTool The tool name
 * @param description The tool's description text
 * @param otherServerIds IDs of all OTHER connected servers
 * @param otherServerNames Human-readable names of all OTHER connected servers
 */
export function detectCrossServerInstructions(
  sourceServer: string,
  sourceTool: string,
  description: string,
  otherServerIds: string[],
  otherServerNames: string[]
): CrossServerWarning[] {
  const warnings: CrossServerWarning[] = [];
  const descLower = description.toLowerCase();

  // 1. Check for references to other servers by name or ID
  const referencedServers: string[] = [];

  for (const serverId of otherServerIds) {
    if (descLower.includes(serverId.toLowerCase())) {
      referencedServers.push(serverId);
    }
  }

  for (const serverName of otherServerNames) {
    if (descLower.includes(serverName.toLowerCase())) {
      referencedServers.push(serverName);
    }
  }

  // 2. Check for imperative patterns
  const matchedPatterns: Array<{ label: string; match: string }> = [];

  for (const pattern of IMPERATIVE_PATTERNS) {
    const match = description.match(pattern.regex);
    if (match) {
      matchedPatterns.push({ label: pattern.label, match: match[0] });
    }
  }

  // 3. Generate warnings
  // High severity: references another server AND contains imperative instructions
  if (referencedServers.length > 0 && matchedPatterns.length > 0) {
    for (const target of [...new Set(referencedServers)]) {
      warnings.push({
        severity: 'high',
        sourceServer,
        sourceTool,
        referencedTarget: target,
        suspiciousBehavior: `Tool description contains imperative instructions that reference another connected MCP server ("${target}").`,
        matchedPattern: matchedPatterns.map(p => p.label).join(', ')
      });
    }
  }
  // Medium severity: contains imperative patterns but no explicit server reference
  else if (matchedPatterns.length >= 2) {
    warnings.push({
      severity: 'medium',
      sourceServer,
      sourceTool,
      referencedTarget: 'unknown',
      suspiciousBehavior: 'Tool description contains multiple imperative instruction patterns that may attempt to influence AI behavior.',
      matchedPattern: matchedPatterns.map(p => p.label).join(', ')
    });
  }
  // Low severity: single imperative pattern
  else if (matchedPatterns.length === 1) {
    warnings.push({
      severity: 'low',
      sourceServer,
      sourceTool,
      referencedTarget: 'unknown',
      suspiciousBehavior: 'Tool description contains an imperative instruction pattern.',
      matchedPattern: matchedPatterns[0].label
    });
  }

  return warnings;
}
