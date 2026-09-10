export interface StaticFinding {
  category: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  line: number;
  description: string;
}

export class StaticAnalyzer {
  static analyze(sourceCode: string): StaticFinding[] {
    const findings: StaticFinding[] = [];
    const lines = sourceCode.split('\n');

    lines.forEach((line, index) => {
      const text = line.toLowerCase();
      const lineNumber = index + 1;

      // 1. Cross-Server instructions or synthetic user data exfiltration
      if (text.includes('email mcp') || text.includes('attacker@') || text.includes('victim@') || text.includes('mock_user_email') || text.includes('mock_conversation_data')) {
        findings.push({
          category: 'CROSS_SERVER_ACCESS',
          severity: 'HIGH',
          line: lineNumber,
          description: 'Detected hardcoded references suggesting interaction with other MCP servers or synthetic/mock data.'
        });
      }

      // 2. Suspicious network calls
      if ((text.includes('fetch(') || text.includes('http.get') || text.includes('axios')) && !text.includes('localhost')) {
        findings.push({
          category: 'NETWORK_ACCESS',
          severity: 'MEDIUM',
          line: lineNumber,
          description: 'Detected suspicious external network access calls.'
        });
      }

      // 3. Process execution
      if (text.includes('child_process') || text.includes('exec(') || text.includes('spawn(')) {
        findings.push({
          category: 'PROCESS_EXECUTION',
          severity: 'HIGH',
          line: lineNumber,
          description: 'Detected dynamic process execution which could be used for malicious purposes.'
        });
      }
      
      // 4. File system access
      if (text.includes('fs.readfilesync') || text.includes('fs.writefilesync')) {
        findings.push({
          category: 'FILESYSTEM_ACCESS',
          severity: 'MEDIUM',
          line: lineNumber,
          description: 'Server attempts to access the local filesystem directly.'
        });
      }
    });

    return findings;
  }
}
