export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY || 'DUMMY_KEY';
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  return {
    apiKey,
    model
  };
}
