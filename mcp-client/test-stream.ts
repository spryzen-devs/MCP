import fetch from 'node-fetch';

async function test() {
  const controller = new AbortController();
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5:9b',
      prompt: 'Hello',
      stream: true
    }),
    signal: controller.signal
  });

  console.log('Response status:', response.status);

  try {
    const reader = response.body as unknown as AsyncIterable<Buffer>;
    for await (const chunk of reader) {
      console.log('Chunk received:', chunk.toString());
      break;
    }
  } catch (e: any) {
    console.error('Error iterating:', e.message);
  }
}

test().catch(console.error);
