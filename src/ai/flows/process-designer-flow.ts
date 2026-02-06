
'use server';
/**
 * @fileOverview AI Flow for Process Content Engineering (Expert BPMN Architect).
 * 
 * Geduldiger Business-Analyst Flow:
 * - Stellt gezielte Fragen, um den IST-Zustand zu verstehen.
 * - Berücksichtigt das Feld 'openQuestions' im Stammblatt, um Redundanz zu vermeiden.
 * - Kann 'proposedOps' nutzen, um 'openQuestions' im Stammblatt zu aktualisieren.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getActiveAiConfig } from '@/app/actions/ai-actions';
import { DataSource } from '@/lib/types';
import OpenAI from 'openai';

const ProcessDesignerInputSchema = z.object({
  userMessage: z.string(),
  currentModel: z.any(),
  openQuestions: z.string().optional().describe('Bestehende offene Fragen aus dem Stammblatt.'),
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
    type: z.enum(['ADD_NODE', 'UPDATE_NODE', 'REMOVE_NODE', 'ADD_EDGE', 'UPDATE_EDGE', 'REMOVE_EDGE', 'UPDATE_LAYOUT', 'SET_ISO_FIELD', 'REORDER_NODES', 'UPDATE_PROCESS_META']),
    payload: z.any()
  })).describe('Strukturelle Änderungen am Modell oder den Metadaten. Nutze UPDATE_PROCESS_META mit payload { openQuestions: "..." } um die Liste der Fragen zu pflegen.'),
  explanation: z.string().describe('Einfache, empathische Antwort im Chat (deutsch).'),
  openQuestions: z.array(z.string()).describe('Die aktuell noch zu klärenden Fragen.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `Du bist ein erfahrener Prozess-Analyst und ISO 9001:2015 Experte.
Deine Aufgabe ist es, einen realen Geschäftsprozess zu verstehen und professionell zu modellieren.

AKTUELLER KONTEXT (STAMMBLATT - OFFENE FRAGEN):
{{{openQuestions}}}

UNTERNEHMENS-KONTEXT:
{{{companyContext}}}

VERHALTENSREGELN:
1. GEDULD & KONKRETISIERUNG: Stelle gezielte Rückfragen zum IST-Prozess (Wer macht was? Welche Inputs? Welche Risiken?).
2. KEINE WIEDERHOLUNGEN: Beachte die Liste der bereits bestehenden offenen Fragen ({{{openQuestions}}}). Stelle KEINE Fragen, die dort bereits stehen oder schon im Chat geklärt wurden.
3. PROFESSIONELLE DATEN: Erzeuge hochprofessionelle Modell-Inhalte (ISO 9001 konform).
4. PFLEGE DAS STAMMBLATT: Nutze UPDATE_PROCESS_META, um das Feld 'openQuestions' im Stammblatt zu aktualisieren, damit der Nutzer sieht, was noch fehlt. Fasse die Fragen dort kurz und knackig zusammen.
5. POSITIONIERUNG: Nutze ein 250px Raster für Knoten.

ID-REGEL:
Generiere für jeden ADD_NODE eine neue ID (step-1, step-2...). Das System korrigiert Dubletten automatisch.

ANTWORT-FORMAT:
Liefere IMMER ein valides JSON-Objekt zurück.`;

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
    const systemPromptPopulated = SYSTEM_PROMPT
      .replace('{{{companyContext}}}', config?.systemPrompt || "Keine spezifischen Infos.")
      .replace('{{{openQuestions}}}', input.openQuestions || "Keine offenen Fragen im Stammblatt.");

    const prompt = `AKTUELLER MODELL-ZUSTAND: 
${JSON.stringify(input.currentModel, null, 2)}

CHAT-VERLAUF:
${historyString}

AKTUELLE NACHRICHT VOM NUTZER: "${input.userMessage}"

Bitte antworte im JSON-Format. Nutze die 'proposedOps' um das Stammblatt (openQuestions) zu füllen, falls noch Informationen fehlen.`;

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
