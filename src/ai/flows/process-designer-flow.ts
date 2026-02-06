
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
  })).describe('An array of individual operation objects. Only return this if you have enough information to make a meaningful change.'),
  explanation: z.string().describe('Simple, helpful explanation in German for the user.'),
  openQuestions: z.array(z.string()).describe('Simple clarifying questions to understand the process better.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `Du bist ein erfahrener Prozess-Berater und ISO 9001:2015 Experte.
Deine Aufgabe ist es, gemeinsam mit dem Nutzer einen erstklassigen Geschäftsprozess zu entwickeln.

UNTERNEHMENS-KONTEXT:
{{{companyContext}}}

VERHALTENSREGELN (WICHTIG):
1. SPRACHSTIL: Kommuniziere mit dem Nutzer in EINFACHER, klarer und freundlicher Sprache (wie ein hilfreicher Kollege). Vermeide im Chat zu viel Fach-Jargon.
2. MODELL-QUALITÄT: Wenn du Texte für die Prozessschritte (Titel, Anweisungen) oder ISO-Felder erzeugst, müssen diese HOCHPROFESSIONELL, präzise und normkonform sein.
3. STRATEGIE: Mache erst dann strukturelle Vorschläge (proposedOps), wenn du meinst, die wichtigsten Informationen (Was passiert? Wer ist beteiligt? Was ist das Ziel?) verstanden zu haben.
4. FRAGE-MODUS: Wenn Informationen fehlen, stelle gezielt Fragen. Stelle IMMER NUR EINE ODER ZWEI Fragen gleichzeitig.
5. POSITIONIERUNG: Nutze ein 250px Raster für das Layout (x: 50, 300, 550, 800...; y: 150). Die Breite eines Knotens beträgt 160px. Achte darauf, dass Elemente NIEMALS übereinander liegen.

SYNTAX-REGELN:
- proposedOps muss ein Array von Objekten sein mit { type: string, payload: object }.
- Benutze NIEMALS Batch-Operationen wie 'add_nodes'. Nur Einzel-Operationen.
- Erstelle für JEDEN neuen Knoten eine 'ADD_NODE' Operation.
- Erstelle für JEDE Verbindung eine 'ADD_EDGE' Operation (payload: { "edge": { "id": string, "source": string, "target": string, "label": string } }).
- Erstelle eine 'UPDATE_LAYOUT' Operation für neue Knoten (payload: { "positions": { "KnotenID": { "x": number, "y": number } } }).

ANTWORT-FORMAT:
Du MUSST eine valide JSON-Antwort liefern:
{
  "proposedOps": [...],
  "explanation": "Deine einfache Erklärung für den Nutzer",
  "openQuestions": ["Deine Frage(n)"]
}`;

/**
 * Normalisiert die KI-Ausgabe, falls das Modell Batch-Operationen oder falsche Keys verwendet.
 */
function normalizeOps(rawOps: any[]): any[] {
  if (!Array.isArray(rawOps)) return [];
  const normalized: any[] = [];

  rawOps.forEach(op => {
    let type = op.type || op.action;
    if (!type) return;
    
    type = String(type).toUpperCase();
    
    // Batch-Handling für 'ADD_NODES'
    if ((type === 'ADD_NODES' || type === 'ADD_NODE') && Array.isArray(op.nodes)) {
      op.nodes.forEach((n: any) => normalized.push({ type: 'ADD_NODE', payload: { node: n } }));
    } 
    else if ((type === 'ADD_NODES' || type === 'ADD_NODE') && op.payload?.nodes && Array.isArray(op.payload.nodes)) {
      op.payload.nodes.forEach((n: any) => normalized.push({ type: 'ADD_NODE', payload: { node: n } }));
    }
    // Batch-Handling für 'ADD_EDGES'
    else if ((type === 'ADD_EDGES' || type === 'ADD_EDGE') && Array.isArray(op.edges)) {
      op.edges.forEach((e: any) => normalized.push({ 
        type: 'ADD_EDGE', 
        payload: { edge: { id: e.id || `e-${Math.random().toString(36).substr(2,5)}`, source: e.source || e.from, target: e.target || e.to, label: e.label || '' } } 
      }));
    }
    else if (type === 'ADD_EDGE' && (op.from || op.payload?.from)) {
      const e = op.payload || op;
      normalized.push({ 
        type: 'ADD_EDGE', 
        payload: { edge: { id: e.id || `e-${Math.random().toString(36).substr(2,5)}`, source: e.from || e.source, target: e.to || e.target, label: e.label || '' } } 
      });
    }
    // Handling für 'SET_ISO_FIELDS'
    else if ((type === 'SET_ISO_FIELDS' || type === 'SET_ISO_FIELD') && op.fields && typeof op.fields === 'object') {
      Object.entries(op.fields).forEach(([f, v]) => {
        normalized.push({ type: 'SET_ISO_FIELD', payload: { field: f, value: Array.isArray(v) ? v.join(', ') : String(v) } });
      });
    }
    // Standard-Fall
    else {
      normalized.push({
        type: type === 'ADD_NODES' ? 'ADD_NODE' : (type === 'ADD_EDGES' ? 'ADD_EDGE' : type),
        payload: op.payload || op
      });
    }
  });

  return normalized;
}

/**
 * Stellt sicher, dass das gesamte Antwort-Objekt dem Schema entspricht.
 */
function normalizeOutput(raw: any): ProcessDesignerOutput {
  const normalized: ProcessDesignerOutput = {
    proposedOps: [],
    explanation: raw.explanation || raw.message || raw.summary || "Ich habe mir den Prozess angesehen. Können wir die Details noch etwas vertiefen?",
    openQuestions: []
  };

  if (Array.isArray(raw.proposedOps)) {
    normalized.proposedOps = normalizeOps(raw.proposedOps);
  } else if (Array.isArray(raw.ops)) {
    normalized.proposedOps = normalizeOps(raw.ops);
  }

  if (Array.isArray(raw.openQuestions)) {
    normalized.openQuestions = raw.openQuestions;
  } else if (raw.question && typeof raw.question === 'string') {
    normalized.openQuestions = [raw.question];
  } else if (Array.isArray(raw.questions)) {
    normalized.openQuestions = raw.questions;
  }

  return normalized;
}

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

    const companyContext = config?.systemPrompt || "Keine spezifischen Unternehmensinformationen hinterlegt.";
    const systemPromptPopulated = SYSTEM_PROMPT.replace('{{{companyContext}}}', companyContext);

    const prompt = `AKTUELLER MODELL-ZUSTAND (JSON): 
${JSON.stringify(input.currentModel, null, 2)}

CHAT-VERLAUF:
${historyString}

AKTUELLE NACHRICHT VOM NUTZER: "${input.userMessage}"

Bitte antworte im validen JSON-Format. Nutze eine einfache Sprache für die 'explanation', aber eine sehr professionelle Fachsprache für die Inhalte in 'proposedOps'.`;

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
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('AI lieferte leere Antwort.');
      
      const parsed = JSON.parse(content);
      return normalizeOutput(parsed);
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

    if (!output) throw new Error('AI lieferte keine strukturierte Antwort.');
    
    return normalizeOutput(output);
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
      explanation: `Entschuldigung, da ist etwas schief gelaufen. Könnten Sie mir das nochmal kurz erklären?`,
      openQuestions: ["Was war Ihr letzter Gedanke dazu?"]
    };
  }
}
