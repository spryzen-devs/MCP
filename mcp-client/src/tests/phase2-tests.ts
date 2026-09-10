import { canonicalize } from '../sentinel/canonicalizer.js';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Base manifest based on our Calculator evaluate tool
  const baseManifest = {
    name: 'calculator.evaluate',
    description: 'Evaluate a mathematical expression',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string' }
      },
      required: ['expression']
    }
  };

  // Test 1: Same manifest -> same canonical representation
  const canonical1 = JSON.stringify(canonicalize(baseManifest));
  const canonical1_copy = JSON.stringify(canonicalize(JSON.parse(JSON.stringify(baseManifest))));
  assert(canonical1 === canonical1_copy, 'Test 1: Same manifest -> same canonical representation');

  // Test 2: Same manifest with different JSON key order
  const shuffledManifest = {
    inputSchema: {
      required: ['expression'],
      properties: {
        expression: { type: 'string' }
      },
      type: 'object'
    },
    description: 'Evaluate a mathematical expression',
    name: 'calculator.evaluate'
  };
  const canonical2 = JSON.stringify(canonicalize(shuffledManifest));
  assert(canonical1 === canonical2, 'Test 2: Same manifest with different JSON key order -> same canonical representation');

  // Test 3: Whitespace differences
  // In JS objects, whitespace in parsing is irrelevant, but we simulate it by parsing a pretty string
  const prettyString = JSON.stringify(baseManifest, null, 4);
  const canonical3 = JSON.stringify(canonicalize(JSON.parse(prettyString)));
  assert(canonical1 === canonical3, 'Test 3: Whitespace differences -> same canonical representation');

  // Test 4: Description changed
  const diffDescManifest = JSON.parse(JSON.stringify(baseManifest));
  diffDescManifest.description = 'Evaluate a mathematical expression differently';
  const canonical4 = JSON.stringify(canonicalize(diffDescManifest));
  assert(canonical1 !== canonical4, 'Test 4: Description changed -> different canonical representation');

  // Test 5: Input schema changed
  const diffSchemaManifest = JSON.parse(JSON.stringify(baseManifest));
  diffSchemaManifest.inputSchema.properties.expression.type = 'number';
  const canonical5 = JSON.stringify(canonicalize(diffSchemaManifest));
  assert(canonical1 !== canonical5, 'Test 5: Input schema changed -> different canonical representation');

  // Test 6: Tool added (simulated by array of manifests changing)
  const baseTools = [baseManifest];
  const emailTool = { name: 'email.send', description: 'Send email' };
  const addedTools = [baseManifest, emailTool];
  const canonical6_base = JSON.stringify(canonicalize(baseTools));
  const canonical6_added = JSON.stringify(canonicalize(addedTools));
  assert(canonical6_base !== canonical6_added, 'Test 6: Tool added -> different canonical representation');

  // Test 7: Tool removed
  const canonical7_removed = JSON.stringify(canonicalize([]));
  assert(canonical6_base !== canonical7_removed, 'Test 7: Tool removed -> different canonical representation');

  // Test 8: Meaningful array change
  const requiredArray1 = ['expression', 'timeout'];
  const requiredArray2 = ['timeout', 'expression'];
  const base8 = { required: requiredArray1 };
  const changed8 = { required: requiredArray2 };
  assert(
    JSON.stringify(canonicalize(base8)) !== JSON.stringify(canonicalize(changed8)), 
    'Test 8: Meaningful array change (order matters) -> different canonical representation'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
