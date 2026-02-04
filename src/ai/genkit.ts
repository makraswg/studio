
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {ollama} from 'genkitx-ollama';

/**
 * Genkit instance configured with both Google AI and Ollama plugins.
 * Provider choice happens at flow execution time by selecting the appropriate model.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
    ollama({
      serverUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    })
  ],
});
