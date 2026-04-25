import OpenAI from 'openai';

// Lazy-initialised, memoised OpenAI client. Instantiating at module load
// crashes `next build` when OPENAI_API_KEY isn't set in the build env (route
// modules are imported during page-data collection).
let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env.local before calling AI features.',
    );
  }
  cached = new OpenAI({ apiKey });
  return cached;
}
