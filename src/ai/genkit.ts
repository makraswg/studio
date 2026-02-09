
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { ollama } from 'genkitx-ollama';

/**
 * Genkit instance configured with Google AI and Ollama plugins.
 * OpenRouter support is implemented directly via OpenAI-compatible API in flows
 * to ensure maximum reliability and version compatibility.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
    ollama()
  ],
});
