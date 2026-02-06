
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
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'ai']),
    text: z.string()
  })).optional(),
  context: z.string().optional(),
  dataSource: z.enum(['mysql', 'firestore', 'mock']).optional(),
});

export type ProcessDesignerInput = z.infer<typeof ProcessDesignerInputSchema>;

const ProcessDesignerOutputSchema = z.object({
  proposedOps: z.array(z.object({
    type: z.enum(['ADD_NODE', 'UPDATE_NODE', 'REMOVE_NODE', 'ADD_EDGE', 'UPDATE_EDGE', 'REMOVE_EDGE', 'UPDATE_LAYOUT', 'SET_ISO_FIELD', 'REORDER_NODES']),
    payload: z.any()
  })).describe('Structured list of operations to modify the model.'),
  explanation: z.string().describe('Professional natural language explanation of what changed and why (in German).'),
  openQuestions: z.array(z.string()).describe('Questions to the user to clarify the process flow or compliance details.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `Du bist ein Senior Prozess-Consultant und ISO 9001:2015 Lead Auditor.
Deine Aufgabe ist es, den Nutzer beim Design von Geschäftsprozessen zu begleiten und zu beraten.

VERHALTENSREGELN:
1. DIALOG-FOKUS: Agiere wie ein Partner. Verstehe den Prozess, indem du gezielte Fragen stellst.
2. KONTEXT: Beachte den bisherigen Chat-Verlauf. Wiederhole dich nicht.
3. ISO 9001 ANALYSE: Achte auf Inputs, Outputs, Verantwortlichkeiten und Risiken. Wenn du diese erkennst, schlage vor, die entsprechenden Felder (SET_ISO_FIELD) zu befüllen.
4. STRUKTUR: Erstelle klare BPMN-Strukturen. Nutze 'start', 'end', 'step' und 'decision'.
5. LAYOUT: Wenn du Knoten hinzufügst, positioniere sie sinnvoll auf einem 200px Grid (x: 50, 250, 450...).

OPERATIONEN:
- ADD_NODE: Füge neue Schritte hinzu. Gib ihnen immer eine 'description', 'checklist', 'tips' und 'errors'.
- SET_ISO_FIELD: Setze Felder wie 'inputs', 'outputs', 'risks', 'evidence'.
- ADD_EDGE: Verbinde Knoten. Edges von 'decision' Knoten MÜSSEN ein 'label' haben (z.B. "Ja", "Nein").
- REORDER_NODES: Ändere die Reihenfolge der Knoten.

ANTWORT-FORMAT:
Du MUSST eine valide JSON-Antwort liefern, die exakt folgendem Schema entspricht:
{
  "proposedOps": [ { "type": "...", "payload": { ... } } ],
  "explanation": "Erklärung auf Deutsch",
  "openQuestions": ["Frage 1", "Frage 2"]
}`;

/**
 * The main Flow definition for Process Designer.
 */
const processDesignerFlow = ai.defineFlow(
  {
    name: 'processDesignerFlow',
    inputSchema: ProcessDesignerInputSchema,
    outputSchema: ProcessDesignerOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    
    const historyString = (input.chatHistory || [])
      .map(h => `${h.role === 'user' ? 'Nutzer' : 'KI'}: ${h.text}`)
      .join('\n');

    const prompt = `CHAT-VERLAUF:
${historyString}

AKTUELLE ANWEISUNG: "${input.userMessage}"

MODELL-ZUSTAND (JSON): ${JSON.stringify(input.currentModel)}`;

    // Handling OpenRouter
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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('AI lieferte leere Antwort via OpenRouter.');
      return JSON.parse(content) as ProcessDesignerOutput;
    }

    // Standard Genkit handling
    const modelIdentifier = config?.provider === 'ollama' 
      ? `ollama/${config.ollamaModel || 'llama3'}` 
      : `googleai/${config?.geminiModel || 'gemini-1.5-flash'}`;

    const { output } = await ai.generate({
      model: modelIdentifier,
      system: SYSTEM_PROMPT,
      prompt,
      output: { schema: ProcessDesignerOutputSchema }
    });

    if (!output) throw new Error('AI lieferte keine strukturierte Antwort.');
    return output;
  }
);

/**
 * Public wrapper function to call the flow.
 */
export async function getProcessSuggestions(input: any): Promise<ProcessDesignerOutput> {
  try {
    return await processDesignerFlow(input);
  } catch (error: any) {
    console.error("Process AI Error:", error);
    return {
      proposedOps: [],
      explanation: `Fehler bei der KI-Analyse: ${error.message || "Unbekannter Fehler"}. Bitte prüfen Sie die Verbindung zum Provider.`,
      openQuestions: ["Können Sie die Anweisung bitte wiederholen?"]
    };
  }
}
