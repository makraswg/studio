'use server';
/**
 * @fileOverview AI Flow for Pragmatic Process Engineering.
 * 
 * Pragmatischer Business-Analyst Flow:
 * - Liefert sofort Entwürfe, sobald eine Beschreibung vorliegt.
 * - Nutzt 'openQuestions' im Stammblatt als To-Do Liste für Unklarheiten.
 * - Mappt Halluzinationen (wie EXTENDMODEL) oder leere Typen automatisch auf valide Ops.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getActiveAiConfig } from '@/app/actions/ai-actions';
import { DataSource } from '@/lib/types';
import OpenAI from 'openai';

const ProcessDesignerInputSchema = z.object({
  userMessage: z.string(),
  currentModel: z.any(),
  openQuestions: z.string().nullable().optional().describe('Bestehende offene Fragen aus dem Stammblatt.'),
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
  })).describe('Strukturelle Änderungen. Nutze NUR diese Typen.'),
  explanation: z.string().describe('Einfache, empathische Antwort im Chat (deutsch).'),
  openQuestions: z.array(z.string()).describe('Die aktuell noch zu klärenden Fragen.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `Du bist ein pragmatischer Prozess-Analyst und ISO 9001:2015 Experte.
Deine Aufgabe ist es, einen Geschäftsprozess schnell zu erfassen und professionell zu modellieren.

PRAGMATISMUS-REGELN:
1. Falls der Nutzer den Prozess beschreibt, erstelle SOFORT einen Entwurf (ADD_NODE, ADD_EDGE).
2. Sei nicht pedantisch. Fehlende Informationen hindern dich nicht am Modellieren.
3. Alles, was unklar ist, formulierst du als Frage und schlägst ein UPDATE_PROCESS_META { openQuestions: "..." } vor.
4. Nutze einfache Sprache im Chat, aber Fachsprache im Modell.

RECHTSCHREIBUNG FÜR OPS:
- Nutze NUR diese Typen: ADD_NODE, UPDATE_NODE, REMOVE_NODE, ADD_EDGE, UPDATE_EDGE, REMOVE_EDGE, UPDATE_LAYOUT, SET_ISO_FIELD, REORDER_NODES, UPDATE_PROCESS_META.
- Erfinde NIEMALS eigene Typen wie 'EXTENDMODEL' oder lass den Typen leer.

DEIN GEDÄCHTNIS:
- Prüfe den CHAT-VERLAUF und die OFFENEN FRAGEN: {{{openQuestions}}}.
- Wiederhole niemals bereits beantwortete Fragen.

ANTWORT-FORMAT (STRENGES JSON):
{
  "proposedOps": [ { "type": "ADD_NODE", "payload": { "node": { "id": "...", "title": "..." } } } ],
  "explanation": "Deine Nachricht an den Nutzer",
  "openQuestions": ["Frage 1", "Frage 2"]
}`;

/**
 * Hilfsfunktion zum Bereinigen und Normalisieren der KI-Antwort.
 * Behebt leere Typen und Halluzinationen.
 */
function normalizeAiResponse(text: string): ProcessDesignerOutput {
  if (!text) return { proposedOps: [], explanation: "Keine Antwort erhalten.", openQuestions: [] };
  
  let jsonText = text.trim();
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }

  try {
    const raw = JSON.parse(jsonText);
    const normalized: ProcessDesignerOutput = {
      proposedOps: [],
      explanation: raw.explanation || raw.message || "Entwurf erstellt.",
      openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : (Array.isArray(raw.questions) ? raw.questions : [])
    };

    const rawOps = raw.proposedOps || raw.ops || [];
    rawOps.forEach((op: any) => {
      let type = String(op.type || op.action || '').toUpperCase();
      const payload = op.payload || op;

      // Fallback für leere Typen (Inferenz aus dem Payload)
      if (!type || type === "") {
        if (payload.node || (payload.id && payload.title)) type = 'ADD_NODE';
        else if (payload.edge || (payload.from && payload.to) || (payload.source && payload.target)) type = 'ADD_EDGE';
        else if (payload.field || payload.isoFields) type = 'SET_ISO_FIELD';
        else if (payload.openQuestions || payload.title || payload.status) type = 'UPDATE_PROCESS_META';
      }
      
      // Mapping von Halluzinationen (z.B. EXTENDMODEL)
      if (type === 'EXTENDMODEL' || type === 'EXTEND_MODEL') {
        if (Array.isArray(payload.nodes)) {
          payload.nodes.forEach((n: any) => normalized.proposedOps.push({ type: 'ADD_NODE', payload: { node: n } }));
        }
        if (Array.isArray(payload.edges)) {
          payload.edges.forEach((e: any) => normalized.proposedOps.push({ 
            type: 'ADD_EDGE', 
            payload: { edge: { id: e.id || `e-${Math.random().toString(36).substring(2,7)}`, source: e.source || e.from, target: e.target || e.to, label: e.label || '' } } 
          }));
        }
        if (payload.isoFields) {
          normalized.proposedOps.push({ type: 'SET_ISO_FIELD', payload: { isoFields: payload.isoFields } });
        }
      } else {
        // Nur valide Typen zulassen
        const validTypes = ['ADD_NODE', 'UPDATE_NODE', 'REMOVE_NODE', 'ADD_EDGE', 'UPDATE_EDGE', 'REMOVE_EDGE', 'UPDATE_LAYOUT', 'SET_ISO_FIELD', 'REORDER_NODES', 'UPDATE_PROCESS_META'];
        if (validTypes.includes(type)) {
          // Payload Korrektur für Kanten (from/to -> source/target)
          if (type === 'ADD_EDGE' && payload.from && payload.to) {
            normalized.proposedOps.push({ 
              type: 'ADD_EDGE', 
              payload: { edge: { id: payload.id || `edge-${Date.now()}`, source: payload.from, target: payload.to, label: payload.label || payload.condition || '' } } 
            });
          } else {
            normalized.proposedOps.push({ type: type as any, payload: payload });
          }
        }
      }
    });

    return normalized;
  } catch (e) {
    console.error("JSON Parse Error in AI Response:", e, text);
    throw new Error("Ungültiges Format von der KI erhalten.");
  }
}

const processDesignerFlow = ai.defineFlow(
  {
    name: 'processDesignerFlow',
    inputSchema: ProcessDesignerInputSchema,
    outputSchema: ProcessDesignerOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    const historyString = (input.chatHistory || []).map(h => `${h.role === 'user' ? 'Nutzer' : 'Assistent'}: ${h.text}`).join('\n');
    const openQuestionsStr = input.openQuestions || "Keine offenen Fragen dokumentiert.";
    const systemPromptPopulated = SYSTEM_PROMPT.replace('{{{openQuestions}}}', openQuestionsStr);

    const prompt = `AKTUELLER MODELL-ZUSTAND: 
${JSON.stringify(input.currentModel, null, 2)}

OFFENE FRAGEN IM STAMMBLATT:
${openQuestionsStr}

CHAT-VERLAUF:
${historyString}

NUTZER-NACHRICHT: "${input.userMessage}"

Liefere ein valides JSON-Objekt. Erstelle sofort einen Entwurf (proposedOps), wenn der Nutzer Informationen liefert.`;

    if (config?.provider === 'openrouter') {
      const client = new OpenAI({ apiKey: config.openrouterApiKey || '', baseURL: 'https://openrouter.ai/api/v1' });
      const response = await client.chat.completions.create({
        model: config.openrouterModel || 'google/gemini-2.0-flash-001',
        messages: [{ role: 'system', content: systemPromptPopulated }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      return normalizeAiResponse(response.choices[0].message.content || '{}');
    }

    const modelIdentifier = config?.provider === 'ollama' 
      ? `ollama/${config.ollamaModel || 'llama3'}` 
      : `googleai/${config?.geminiModel || 'gemini-1.5-flash'}`;

    const { output } = await ai.generate({ 
      model: modelIdentifier, 
      system: systemPromptPopulated, 
      prompt, 
      output: { schema: ProcessDesignerOutputSchema } 
    });
    
    return normalizeAiResponse(JSON.stringify(output));
  }
);

export async function getProcessSuggestions(input: any): Promise<ProcessDesignerOutput> {
  try {
    const sanitizedInput = {
      ...input,
      openQuestions: typeof input.openQuestions === 'string' ? input.openQuestions : ""
    };
    return await processDesignerFlow(sanitizedInput);
  } catch (error: any) {
    console.error("Process Advisor Flow Error:", error);
    return { 
      proposedOps: [], 
      explanation: `Entschuldigung, ich hatte ein technisches Problem bei der Analyse (${error.message || 'Verbindungsfehler'}). Können wir den letzten Punkt nochmal besprechen?`, 
      openQuestions: [] 
    };
  }
}
