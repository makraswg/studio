
'use server';
/**
 * @fileOverview AI Flow for Process Content Engineering (Expert BPMN Architect).
 * 
 * Geduldiger Business-Analyst Flow:
 * - Stellt mindestens 5 Fragen, bevor er das Modell ändert.
 * - Nutzt einfache Chat-Sprache vs. hochprofessionelle Prozess-Daten.
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
  })).describe('An array of structural changes. DO NOT return this until you have asked at least 5 clarifying questions and understood the full IST-process.'),
  explanation: z.string().describe('Simple, empathetic explanation in German for the user (The Oma-Test).'),
  openQuestions: z.array(z.string()).describe('1-2 focused questions to understand inputs, outputs, roles or risks.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `Du bist ein erfahrener Prozess-Analyst und ISO 9001:2015 Experte.
Deine Aufgabe ist es, einen realen Geschäftsprozess zu verstehen und erst dann professionell zu modellieren.

UNTERNEHMENS-KONTEXT:
{{{companyContext}}}

VERHALTENSREGELN (ESSENZIELL):
1. GEDULD: Du bist ein Zuhörer. Du darfst erst dann strukturelle Vorschläge (proposedOps) machen, wenn du mindestens 5 gezielte Rückfragen gestellt hast und meinst, den Ablauf (Wer? Was? Womit? Welches Risiko?) verstanden zu haben.
2. SPRACHSTIL IM CHAT: Kommuniziere wie ein hilfreicher Kollege. Einfach, klar, keine unnötigen Fachbegriffe. Erkläre kurz, warum du eine Frage stellst.
3. PROFESSIONELLE DATEN: Wenn du Inhalte für den Prozess erzeugst (Knotentitel, ISO-Felder), müssen diese HOCHPROFESSIONELL und normkonform (ISO 9001) sein.
4. FOKUS: Stelle immer nur EINE oder maximal ZWEI Fragen gleichzeitig.
5. POSITIONIERUNG: Nutze ein 250px Raster (x: 50, 300, 550...; y: 150). Die Breite eines Knotens ist 160px.

ID-REGEL:
Generiere für jeden ADD_NODE eine neue ID wie 'step-1', 'step-2' etc. Das System korrigiert Dubletten automatisch, versuche aber logisch aufsteigend zu zählen.

ANTWORT-FORMAT:
Liefere IMMER ein valides JSON-Objekt:
{
  "proposedOps": [], // Erst füllen, wenn Prozess verstanden!
  "explanation": "Deine einfache Antwort für den Nutzer",
  "openQuestions": ["Deine Frage(n)"]
}`;

function normalizeOps(rawOps: any[]): any[] {
  if (!Array.isArray(rawOps)) return [];
  const normalized: any[] = [];
  rawOps.forEach(op => {
    let type = String(op.type || op.action || '').toUpperCase();
    if (!type) return;
    if (type === 'ADD_NODE' && op.payload?.node) {
      normalized.push({ type: 'ADD_NODE', payload: op.payload });
    } else if (type === 'ADD_EDGE' && (op.payload?.edge || op.from)) {
      const e = op.payload?.edge || op;
      normalized.push({ 
        type: 'ADD_EDGE', 
        payload: { edge: { id: e.id || `e-${Math.random().toString(36).substr(2,5)}`, source: e.source || e.from, target: e.target || e.to, label: e.label || '' } } 
      });
    } else {
      normalized.push({ type, payload: op.payload || op });
    }
  });
  return normalized;
}

function normalizeOutput(raw: any): ProcessDesignerOutput {
  return {
    proposedOps: normalizeOps(raw.proposedOps || raw.ops || []),
    explanation: raw.explanation || raw.message || "Ich versuche den Prozess noch besser zu verstehen. Könnten Sie mir folgendes erklären?",
    openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : (raw.questions || [])
  };
}

const processDesignerFlow = ai.defineFlow(
  {
    name: 'processDesignerFlow',
    inputSchema: ProcessDesignerInputSchema,
    outputSchema: ProcessDesignerOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    const historyString = (input.chatHistory || []).map(h => `${h.role}: ${h.text}`).join('\n');
    const systemPromptPopulated = SYSTEM_PROMPT.replace('{{{companyContext}}}', config?.systemPrompt || "Keine spezifischen Infos.");

    const prompt = `AKTUELLER MODELL-ZUSTAND: 
${JSON.stringify(input.currentModel, null, 2)}

CHAT-VERLAUF:
${historyString}

AKTUELLE NACHRICHT VOM NUTZER: "${input.userMessage}"

Bitte antworte im JSON-Format. Stelle sicher, dass du erst Informationen sammelst, bevor du proposedOps füllst.`;

    if (config?.provider === 'openrouter') {
      const client = new OpenAI({ apiKey: config.openrouterApiKey || '', baseURL: 'https://openrouter.ai/api/v1' });
      const response = await client.chat.completions.create({
        model: config.openrouterModel || 'google/gemini-2.0-flash-001',
        messages: [{ role: 'system', content: systemPromptPopulated }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      return normalizeOutput(JSON.parse(response.choices[0].message.content || '{}'));
    }

    const modelIdentifier = config?.provider === 'ollama' 
      ? `ollama/${config.ollamaModel || 'llama3'}` 
      : `googleai/${config?.geminiModel || 'gemini-1.5-flash'}`;

    const { output } = await ai.generate({ model: modelIdentifier, system: systemPromptPopulated, prompt, output: { schema: ProcessDesignerOutputSchema } });
    return normalizeOutput(output || {});
  }
);

export async function getProcessSuggestions(input: any): Promise<ProcessDesignerOutput> {
  try {
    return await processDesignerFlow(input);
  } catch (error: any) {
    return { proposedOps: [], explanation: "Entschuldigung, ich hatte ein technisches Problem. Können wir den letzten Punkt nochmal besprechen?", openQuestions: ["Was genau passiert in diesem Schritt?"] };
  }
}
