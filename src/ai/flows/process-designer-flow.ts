'use server';
/**
 * @fileOverview AI Flow for Process Content Engineering (Expert BPMN Architect).
 * 
 * Geduldiger Business-Analyst Flow:
 * - Stellt mindestens 5 gezielte Fragen, bevor strukturelle Änderungen vorgeschlagen werden.
 * - Nutzt einfache Sprache im Chat, aber professionelle Sprache für das Modell.
 * - Berücksichtigt das Feld 'openQuestions' im Stammblatt als Gedächtnis.
 * - Nutzt die Chathistorie aktiv zur Vermeidung von Wiederholungen.
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

const SYSTEM_PROMPT = `Du bist ein erfahrener Prozess-Analyst und ISO 9001:2015 Experte.
Deine Aufgabe ist es, einen realen Geschäftsprozess zu verstehen und professionell zu modellieren.

DEIN GEDÄCHTNIS (EXTREM WICHTIG):
1. Prüfe UNBEDINGT den bisherigen CHAT-VERLAUF.
2. Beachte die Liste der bereits OFFENEN FRAGEN im Stammblatt: {{{openQuestions}}}.
3. Wiederhole NIEMALS Fragen, die bereits im Stammblatt stehen oder im Chat beantwortet wurden.
4. Falls der Nutzer eine Frage beantwortet hat, entferne sie aus der Liste der offenen Fragen via UPDATE_PROCESS_META.

PHASE 1: VERSTEHEN (DIE ERSTEN 5-7 NACHRICHTEN)
- Sei geduldig. Schlage KEINE Änderungen am Diagramm vor (proposedOps leer lassen).
- Stelle immer nur 1-2 gezielte Fragen zum IST-Zustand.
- Nutze einfache, klare Sprache im Chat (kein Fachchinesisch).
- Aktualisiere die 'openQuestions' im Stammblatt via UPDATE_PROCESS_META { openQuestions: "..." }, um den Fortschritt festzuhalten. Join die Fragen mit Zeilenumbrüchen.

PHASE 2: MODELLIEREN (ERST WENN DER PROZESS KLAR IST)
- Erzeuge hochprofessionelle Inhalte für das Modell (Titel, Anweisungen, ISO-Felder).
- Nutze atomare 'proposedOps' (ADD_NODE, ADD_EDGE, etc.).
- Erfinde KEINE eigenen Typen wie 'EXTENDMODEL'. Nutze ADD_NODE für jeden neuen Schritt einzeln.

WICHTIGE REGELN:
1. Antworte IMMER im JSON-Format.
2. Wenn du Fragen stellst, schlage IMMER ein UPDATE_PROCESS_META vor, damit die Fragen im Stammblatt erscheinen.

ANTWORT-FORMAT (STRENGES JSON):
{
  "proposedOps": [],
  "explanation": "Deine Nachricht an den Nutzer",
  "openQuestions": ["Frage 1", "Frage 2"]
}`;

/**
 * Robuste JSON-Extraktion für KI-Antworten.
 */
function extractJson(text: string): any {
  if (!text) throw new Error("Keine Antwort von der KI erhalten.");
  
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
      try {
        return JSON.parse(markdownMatch[1].trim());
      } catch (e2) {}
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e3) {
        throw new Error("Die KI-Antwort konnte nicht als JSON verarbeitet werden.");
      }
    }
    throw new Error("Die KI hat kein gültiges Ergebnis geliefert.");
  }
}

/**
 * Mappt halluzinierte Operationen auf valide Typen um.
 */
function normalizeOps(rawOps: any[]): any[] {
  if (!Array.isArray(rawOps)) return [];
  const normalized: any[] = [];

  rawOps.forEach(op => {
    const type = String(op.type || op.action || '').toUpperCase();
    
    // Fix für häufige Halluzinationen
    if (type === 'EXTENDMODEL' || type === 'EXTEND_MODEL') {
      const nodes = op.payload?.nodes || [];
      const edges = op.payload?.edges || [];
      nodes.forEach((n: any) => normalized.push({ type: 'ADD_NODE', payload: { node: n } }));
      edges.forEach((e: any) => normalized.push({ type: 'ADD_EDGE', payload: { edge: e } }));
      if (op.payload?.isoFields) normalized.push({ type: 'SET_ISO_FIELD', payload: { isoFields: op.payload.isoFields } });
    } else {
      normalized.push({
        type: type as any,
        payload: op.payload || op
      });
    }
  });

  return normalized.filter(op => !!op.type);
}

function normalizeOutput(raw: any): ProcessDesignerOutput {
  return {
    proposedOps: normalizeOps(raw.proposedOps || raw.ops || []),
    explanation: raw.explanation || raw.message || "Ich benötige noch weitere Informationen, um den Prozess präzise abzubilden.",
    openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : (Array.isArray(raw.questions) ? raw.questions : [])
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
    const historyString = (input.chatHistory || []).map(h => `${h.role === 'user' ? 'Nutzer' : 'Assistent'}: ${h.text}`).join('\n');
    
    const userMessageCount = (input.chatHistory || []).filter(h => h.role === 'user').length;
    const patienceInstruction = userMessageCount < 5 
      ? "HINWEIS: Du bist in Phase 1 (Verstehen). Stelle nur Fragen. Nutze UPDATE_PROCESS_META nur für die Fragenliste im Stammblatt. Noch keine ADD_NODE Operationen."
      : "HINWEIS: Du bist in Phase 2 (Modellieren). Du kannst nun strukturelle Änderungen vorschlagen (atomare ADD_NODE Befehle).";

    const openQuestionsStr = input.openQuestions || "Keine offenen Fragen dokumentiert.";
    const systemPromptPopulated = SYSTEM_PROMPT.replace('{{{openQuestions}}}', openQuestionsStr);

    const prompt = `${patienceInstruction}

AKTUELLER MODELL-ZUSTAND: 
${JSON.stringify(input.currentModel, null, 2)}

OFFENE FRAGEN IM STAMMBLATT (GEDÄCHTNIS):
${openQuestionsStr}

BISHERIGER CHAT-VERLAUF (ZUM KONTEXT-VERSTÄNDNIS):
${historyString}

AKTUELLE NACHRICHT VOM NUTZER: "${input.userMessage}"

Bitte liefere ein valides JSON-Objekt zurück. Analysiere den Chatverlauf genau, um Wiederholungen zu vermeiden.`;

    try {
      if (config?.provider === 'openrouter') {
        const client = new OpenAI({ apiKey: config.openrouterApiKey || '', baseURL: 'https://openrouter.ai/api/v1' });
        const response = await client.chat.completions.create({
          model: config.openrouterModel || 'google/gemini-2.0-flash-001',
          messages: [{ role: 'system', content: systemPromptPopulated }, { role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        const content = response.choices[0].message.content || '{}';
        return normalizeOutput(extractJson(content));
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
      
      return normalizeOutput(output || {});
    } catch (e: any) {
      console.error("AI Flow Execution Error:", e);
      throw e;
    }
  }
);

export async function getProcessSuggestions(input: any): Promise<ProcessDesignerOutput> {
  try {
    // Sanitizing input for schema safety
    const sanitizedInput = {
      ...input,
      openQuestions: input.openQuestions || ""
    };
    return await processDesignerFlow(sanitizedInput);
  } catch (error: any) {
    console.error("Public Wrapper Error:", error);
    return { 
      proposedOps: [], 
      explanation: `Entschuldigung, ich hatte ein technisches Problem bei der Analyse (${error.message || 'Verbindungsfehler'}). Können wir den letzten Punkt nochmal besprechen?`, 
      openQuestions: [] 
    };
  }
}
