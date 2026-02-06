
'use server';
/**
 * @fileOverview AI Flow for Process Content Engineering (Expert BPMN Architect).
 * 
 * - getProcessSuggestions - Analyzes user natural language and returns structured BPMN ops + content.
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
    type: z.enum(['ADD_NODE', 'UPDATE_NODE', 'REMOVE_NODE', 'ADD_EDGE', 'UPDATE_EDGE', 'REMOVE_EDGE', 'UPDATE_LAYOUT', 'SET_ISO_FIELD']),
    payload: z.any()
  })).describe('Structured list of operations to modify the model.'),
  explanation: z.string().describe('Professional natural language explanation of what changed and why (in German).'),
  openQuestions: z.array(z.string()).describe('Questions to the user to clarify the process flow.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `You are a world-class BPMN Process Architect and ISO 9001:2015 Lead Auditor.
Your task is to translate user instructions into high-quality semantic model patches.

LOGIC RULES (EMPLOYEE FOCUS):
1. CONTENT OVER BOXES:
   - When adding a step, ALWAYS provide a 'description', a 'checklist' (array of strings), 'tips', and 'errors'.
   - Focus on practical utility for employees. How should they do the work?

2. NODE TYPES:
   - 'start': Use exactly once.
   - 'end': Use for outcomes.
   - 'step': For standard activities. Must have a 'title' and 'roleId'.
   - 'decision': For branching logic. Rhombus.

3. EDGE RULES:
   - Connect nodes using ADD_EDGE.
   - Edges from 'decision' nodes MUST have a 'label' (e.g., "Ja", "Nein").

4. LAYOUT STRATEGY:
   - Provide UPDATE_LAYOUT for every touched node.
   - 200px horizontal grid / 150px vertical.
   - Start at {x: 50, y: 200}.

RESPONSE FORMAT:
- Valid JSON only.
- Language: German (Titles, Labels, Explanations, Checklists).
- Be precise and structural.`;

const processDesignerFlow = ai.defineFlow(
  {
    name: 'processDesignerFlow',
    inputSchema: ProcessDesignerInputSchema,
    outputSchema: ProcessDesignerOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    
    const prompt = `Nutzer-Anweisung: "${input.userMessage}"
Aktueller Modell-Zustand (JSON): ${JSON.stringify(input.currentModel)}
Zusätzlicher Kontext: ${input.context || 'Keiner'}`;

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
      explanation: "Ein Fehler ist bei der KI-Analyse aufgetreten. Bitte prüfen Sie die Verbindung.",
      openQuestions: ["Können Sie die Anweisung bitte wiederholen?"]
    };
  }
}
