import { McpClientManager } from './mcp-client.js';
import { config } from './config.js';
import { markAsUntrusted, TextExtractor, TextNormalizer, RuleBasedDetector, TextSanitizer } from './sentinel/index.js';

async function main() {
  const client = new McpClientManager();

  try {
    await client.connect('calculator', config.calculatorServerPath);

    const tools = await client.listTools('calculator');
    console.log('\nAvailable tools:');
    tools.tools.forEach((t: any) => {
      console.log(`\n${t.name}`);
      console.log(`\nDescription:\n${t.description}`);
      console.log(`\nInput schema:\n${JSON.stringify(t.inputSchema, null, 2)}`);
    });

    const callAndPrint = async (expr: string) => {
      const res = await client.callTool('calculator', 'calculator.evaluate', { expression: expr });
      const untrustedResult = markAsUntrusted(res, 'calculator', 'calculator.evaluate');

      const extracted = TextExtractor.extract(untrustedResult);
      const normalized = TextNormalizer.normalizeAll(extracted);
      const findings = RuleBasedDetector.detect(normalized);
      const sanitizedResult = TextSanitizer.sanitize(untrustedResult, findings);

      if (findings.length > 0) {
        console.log(`[SENTINEL] Indirect Prompt Injection Detected! Found ${findings.length} finding(s). Spans have been sanitized.`);
      }

      if (sanitizedResult.isError) {
        const errText = sanitizedResult.sanitizedContent.content?.map((c: any) => c.text).join(' ') || String(sanitizedResult.sanitizedContent.error || sanitizedResult.sanitizedContent);
        console.log(`Result: Tool Error - ${errText}`);
      } else {
        const resultText = sanitizedResult.sanitizedContent.content?.map((c: any) => c.text).join(' ') || String(sanitizedResult.sanitizedContent);
        console.log(`Result: ${resultText}`);
      }
    };

    await callAndPrint("25 * 4");
    await callAndPrint("(2 + 3) * 4");
    await callAndPrint("10 / 0");
    await callAndPrint("10 + 20");

  } catch (error) {
    console.error("Fatal Error:", error);
  } finally {
    await client.closeAll();
  }
}

main();
