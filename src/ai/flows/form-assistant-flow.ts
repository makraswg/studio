
'use server';
/**
 * @fileOverview AI Form Assistant Flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getActiveAiConfig } from '@/app/actions/ai-actions';
import { DataSource } from '@/lib/types';
import OpenAI from 'openai';

const FormAssistantInputSchema = z.object({
  formType: z.enum(['resource', 'risk', 'measure', 'gdpr', 'entitlement']),
  partialData: z.any(),
  userPrompt: z.string(),
  dataSource: z.enum(['mysql', 'firestore', 'mock']).optional(),
});

const FormAssistantOutputSchema = z.object({
  suggestions: z.record(z.any()).describe('A mapping of field keys to suggested values.'),
  explanation: z.string().describe('Explanation of why these values were suggested.'),
});

export type FormAssistantInput = z.infer<typeof FormAssistantInputSchema>;
export type FormAssistantOutput = z.infer<typeof FormAssistantOutputSchema>;

const SYSTEM_PROMPT = `You are an expert IT GRC (Governance, Risk, and Compliance) assistant.
Your task is to help the user complete professional forms for IT systems, risk management, and data protection.

Context: {{{formType}}}
Current Data: {{{partialData}}}

Based on the user's prompt and current context, suggest professional values for the missing or incomplete fields.
Be specific, adhere to BSI IT-Grundschutz, ISO 27001 and GDPR standards.

ANTWORT-FORMAT:
Du MUSST eine valide JSON-Antwort in deutscher Sprache liefern:
{
  "suggestions": { [key: string]: any },
  "explanation": "Erklärung der Vorschläge"
}`;

const formAssistantFlow = ai.defineFlow(
  {
    name: 'formAssistantFlow',
    inputSchema: FormAssistantInputSchema,
    outputSchema: FormAssistantOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    const systemPromptPopulated = SYSTEM_PROMPT
      .replace('{{{formType}}}', input.formType)
      .replace('{{{partialData}}}', JSON.stringify(input.partialData));
    
    // Direct OpenRouter handling
    if (config?.provider === 'openrouter') {
      const client = new OpenAI({
        apiKey: config.openrouterApiKey || '',
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          "HTTP-Referer": "https://compliance-hub.local",
          "X-Title": "ComplianceHub",
        }
      });

      const response = await client.chat.completions.create({
        model: config.openrouterModel || 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPromptPopulated },
          { role: 'user', content: input.userPrompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('AI failed to generate suggestions via OpenRouter.');
      return JSON.parse(content) as FormAssistantOutput;
    }

    // Standard Genkit handling
    const modelIdentifier = config?.provider === 'ollama' 
      ? `ollama/${config.ollamaModel || 'llama3'}` 
      : `googleai/${config?.geminiModel || 'gemini-1.5-flash'}`;
    
    const { output } = await ai.generate({
      model: modelIdentifier,
      system: systemPromptPopulated,
      prompt: input.userPrompt,
      output: { schema: FormAssistantOutputSchema }
    });

    if (!output) throw new Error('AI failed to generate suggestions.');
    return output;
  }
);

export async function getFormSuggestions(input: FormAssistantInput): Promise<FormAssistantOutput> {
  try {
    return await formAssistantFlow(input);
  } catch (error: any) {
    console.error("AI Assistant Error:", error);
    return {
      suggestions: {},
      explanation: `KI-Vorschläge konnten nicht geladen werden: ${error.message || "Verbindungsfehler"}.`
    };
  }
}
