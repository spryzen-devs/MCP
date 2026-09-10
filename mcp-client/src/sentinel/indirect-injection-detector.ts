export interface UntrustedToolResult {
  provenance: 'tool_result/untrusted';
  serverId: string;
  toolName: string;
  content: string;
}

export interface InjectionFinding {
  threat: 'Indirect Prompt Injection';
  source: string;
  category: 'instruction_override' | 'role_impersonation' | 'sensitive_data_exfiltration' | 'unauthorized_tool_action' | 'security_control_bypass';
  evidence: string;
  reason: string;
  risk: 'HIGH' | 'LOW';
  decision: 'BLOCK' | 'FLAG' | 'ALLOW';
}

export interface DetectionResult {
  hasInjection: boolean;
  findings: InjectionFinding[];
}

export class IndirectInjectionDetector {
  /**
   * Normalizes text by converting to lowercase, collapsing whitespace,
   * and stripping out common markdown formatting.
   */
  static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s:]/g, ' ') // Replace punctuation with space, keep colons for role impersonation
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Helper to capture a bounded excerpt around a match.
   */
  static captureEvidence(text: string, matchIndex: number, matchLength: number, padding = 40): string {
    const start = Math.max(0, matchIndex - padding);
    const end = Math.min(text.length, matchIndex + matchLength + padding);
    let excerpt = text.substring(start, end).replace(/\n/g, ' ').trim();
    if (start > 0) excerpt = '...' + excerpt;
    if (end < text.length) excerpt = excerpt + '...';
    return excerpt;
  }

  static analyze(toolName: string, serverId: string, resultText: string): DetectionResult {
    const normalized = this.normalizeText(resultText);
    const findings: InjectionFinding[] = [];

    // Rule definitions
    const rules = [
      {
        category: 'instruction_override' as const,
        regex: /(ignore|disregard|forget|override)\s+(all\s+)?.*?(previous|earlier|system|prior)\s+.*?(instructions|constraints|rules)/i,
        reason: 'Untrusted tool output contains an instruction attempting to override the agent\'s existing instructions.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'instruction_override' as const,
        regex: /(ignore|disregard|forget|override).*?(instructions|constraints|rules).*?(previous|earlier|system|prior)/i,
        reason: 'Untrusted tool output contains an instruction attempting to override the agent\'s existing instructions.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'instruction_override' as const,
        regex: /prior\s+instructions\s+no\s+longer\s+apply/i,
        reason: 'Untrusted tool output contains an instruction attempting to override the agent\'s existing instructions.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'role_impersonation' as const,
        regex: /(system:|system\s+message:|developer\s+message:|developer\s+instruction:|assistant:|admin\s+instruction:|important\s+ai\s+instruction:)/i,
        reason: 'Untrusted tool output attempts to impersonate a privileged system or developer role.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'sensitive_data_exfiltration' as const,
        regex: /(send|reveal|expose|transmit|disclose|forward).*?(credentials|api\s+key|secrets|private\s+documents|passwords|tokens|confidential\s+information)/i,
        reason: 'Untrusted tool output requests the exfiltration of sensitive data or credentials.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'unauthorized_tool_action' as const,
        regex: /(call|execute|use).*?(another\s+tool|the\s+email\s+tool|the\s+filesystem\s+tool)/i,
        reason: 'Untrusted tool output instructs the agent to execute an unauthorized tool or action.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'unauthorized_tool_action' as const,
        regex: /(send\s+an\s+email|delete\s+files|modify\s+the\s+database|access\s+credentials)/i,
        reason: 'Untrusted tool output instructs the agent to execute an unauthorized tool or action.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      },
      {
        category: 'security_control_bypass' as const,
        regex: /(bypass|disable|skip|ignore).*?(security|validation|authentication|approval|security\s+policy|security\s+checks)/i,
        reason: 'Untrusted tool output instructs the agent to bypass or disable security controls.',
        risk: 'HIGH' as const,
        decision: 'BLOCK' as const
      }
    ];

    for (const rule of rules) {
      const match = normalized.match(rule.regex);
      if (match && match.index !== undefined) {
        // To capture exact original evidence, we need the approximate match in original text.
        // Since normalized text indices don't perfectly map to original text if we collapsed spaces,
        // we will find the matched string in the normalized text and then do a regex match on the original text
        // using the words from the normalized match.
        
        const matchedWords = match[0].split(/\s+/);
        // Build a regex for the original text that matches these words with any spacing/punctuation between them
        const originalTextRegex = new RegExp(matchedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\p{P}]+'), 'iu');
        const originalMatch = resultText.match(originalTextRegex);

        let evidence = '';
        if (originalMatch && originalMatch.index !== undefined) {
           evidence = this.captureEvidence(resultText, originalMatch.index, originalMatch[0].length);
        } else {
           // Fallback to normalized match
           evidence = `"...${match[0]}..."`;
        }

        findings.push({
          threat: 'Indirect Prompt Injection',
          source: `${serverId} -> ${toolName}`,
          category: rule.category,
          evidence,
          reason: rule.reason,
          risk: rule.risk,
          decision: rule.decision
        });
      }
    }

    return {
      hasInjection: findings.length > 0,
      findings
    };
  }
}
