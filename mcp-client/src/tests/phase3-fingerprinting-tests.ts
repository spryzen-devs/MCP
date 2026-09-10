import { hashManifest, hashServerManifests, toToolManifest } from '../sentinel/canonicalizer.js';

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

  const baseManifestRaw = {
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

  const emailRaw1 = { name: 'email.send', description: 'Send email' };
  const emailRaw2 = { name: 'email.read', description: 'Read emails' };

  const baseManifest = toToolManifest('calculator', baseManifestRaw);
  const email1 = toToolManifest('email', emailRaw1);
  const email2 = toToolManifest('email', emailRaw2);

  // Test 1: Same manifest -> same fingerprint
  const hash1 = hashManifest(baseManifest);
  const hash1_copy = hashManifest(toToolManifest('calculator', JSON.parse(JSON.stringify(baseManifestRaw))));
  assert(hash1 === hash1_copy, 'Test 1: Same manifest -> same fingerprint');

  // Test 2: Different JSON key order -> same fingerprint
  const shuffledManifestRaw = {
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
  const hash2 = hashManifest(toToolManifest('calculator', shuffledManifestRaw));
  assert(hash1 === hash2, 'Test 2: Different JSON key order -> same fingerprint');

  // Test 3: Description mutation -> different fingerprint
  const descMutRaw = JSON.parse(JSON.stringify(baseManifestRaw));
  descMutRaw.description = 'Evaluate a mathematical expression differently';
  const hash3 = hashManifest(toToolManifest('calculator', descMutRaw));
  assert(hash1 !== hash3, 'Test 3: Description mutation -> different fingerprint');

  // Test 4: Schema mutation -> different fingerprint
  const schemaMutRaw = JSON.parse(JSON.stringify(baseManifestRaw));
  schemaMutRaw.inputSchema.properties.expression.type = 'number';
  const hash4 = hashManifest(toToolManifest('calculator', schemaMutRaw));
  assert(hash1 !== hash4, 'Test 4: Schema mutation -> different fingerprint');

  // Test 5: Tool addition -> different server fingerprint
  const serverHashBase = hashServerManifests([email1]);
  const serverHashAdded = hashServerManifests([email1, email2]);
  assert(serverHashBase !== serverHashAdded, 'Test 5: Tool addition -> different server fingerprint');

  // Test 6: Tool removal -> different server fingerprint
  const serverHashRemoved = hashServerManifests([]);
  assert(serverHashBase !== serverHashRemoved, 'Test 6: Tool removal -> different server fingerprint');

  // Test 7: Individual tool fingerprint changes only when that tool's canonical manifest changes
  // email2 changed, email1 stayed same
  const email2MutRaw = JSON.parse(JSON.stringify(emailRaw2));
  email2MutRaw.description = 'Read unread emails';
  const email2Mut = toToolManifest('email', email2MutRaw);
  
  const hashEmail1 = hashManifest(email1);
  const hashEmail1_again = hashManifest(toToolManifest('email', JSON.parse(JSON.stringify(emailRaw1))));
  const hashEmail2 = hashManifest(email2);
  const hashEmail2Mut = hashManifest(email2Mut);

  assert(
    hashEmail1 === hashEmail1_again && hashEmail2 !== hashEmail2Mut, 
    'Test 7: Individual tool fingerprint changes only when that tool changes'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
