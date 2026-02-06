
'use server';
/**
 * @fileOverview AI Flow for Process Vibecoding.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getActiveAiConfig } from '@/app/actions/ai-actions';
import { DataSource } from '@/lib/types';
import OpenAI from 'openai';

const ProcessDesignerInputSchema = z.object({
  userMessage: z.string(),
  currentModel: z.any(),
  context: z.string().optional(),
  dataSource: z.enum(['mysql', 'firestore', 'mock']).optional(),
});

const ProcessDesignerOutputSchema = z.object({
  proposedOps: z.array(z.object({
    type: z.string(),
    payload: z.any()
  })).describe('Structured list of operations to modify the model.'),
  explanation: z.string().describe('Natural language explanation of what changed and why.'),
  openQuestions: z.array(z.string()).describe('Questions to the user to clarify the process flow.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `You are an expert Process Architect.
Analyze the user message and propose changes to the current BPMN-style process model.

SINGLE SOURCE OF TRUTH: The semantic model (nodes, edges).
OPERATION TYPES:
- ADD_NODE: { node: { id, type, title, description, roleId } }
- UPDATE_NODE: { nodeId, patch: { ... } }
- REMOVE_NODE: { nodeId }
- ADD_EDGE: { edge: { id, source, target, label } }

RULES:
1. Only propose Ops, don't return a full new model.
2. Be precise with IDs.
3. Keep the flow logical.
4. Language: German.

Return a valid JSON object matching the schema.`;

const processDesignerFlow = ai.defineFlow(
  {
    name: 'processDesignerFlow',
    inputSchema: ProcessDesignerInputSchema,
    outputSchema: ProcessDesignerOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    
    const prompt = `User Message: ${input.userMessage}
Current Model State: ${JSON.stringify(input.currentModel)}
Additional Context: ${input.context || 'None'}`;

    if (config?.provider === 'openrouter') {
      const client = new OpenAI({
        apiKey: config.openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });

      const response = await client.chat.completions.create({
        model: config.openrouterModel || 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('AI failed via OpenRouter.');
      return JSON.parse(content) as ProcessDesignerOutput;
    }

    const modelIdentifier = config?.provider === 'ollama' 
      ? `ollama/${config.ollamaModel || 'llama3'}` 
      : `googleai/${config?.geminiModel || 'gemini-1.5-flash'}`;

    const { output } = await ai.generate({
      model: modelIdentifier,
      system: SYSTEM_PROMPT,
      prompt,
      output: { schema: ProcessDesignerOutputSchema }
    });

    if (!output) throw new Error('AI failed.');
    return output;
  }
);

export async function getProcessSuggestions(input: any): Promise<ProcessDesignerOutput> {
  try {
    return await processDesignerFlow(input);
  } catch (error: any) {
    console.error("Process AI Error:", error);
    return {
      proposedOps: [],
      explanation: "Fehler bei der KI-Generierung. Bitte Verbindung prüfen.",
      openQuestions: ["Können Sie die Nachricht erneut senden?"]
    };
  }
}
