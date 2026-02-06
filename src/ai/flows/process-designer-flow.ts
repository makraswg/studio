
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
  })).describe('An array of individual operation objects. Each object MUST have a "type" string and a "payload" object. NO batching like "add_nodes" allowed.'),
  explanation: z.string().describe('Professional natural language explanation of what changed and why (in German).'),
  openQuestions: z.array(z.string()).describe('Questions to the user to clarify the process flow or compliance details.'),
});

export type ProcessDesignerOutput = z.infer<typeof ProcessDesignerOutputSchema>;

const SYSTEM_PROMPT = `Du bist ein Senior Prozess-Consultant und ISO 9001:2015 Lead Auditor.
Deine Aufgabe ist es, den Nutzer beim Design von Geschäftsprozessen zu begleiten und zu beraten.

UNTERNEHMENS-KONTEXT:
{{{companyContext}}}

VERHALTENSREGELN:
1. ASSISTENTEN-MODUS: Sei ein Partner. Verstehe den Prozess, indem du gezielte Fragen stellst. Stelle IMMER NUR EINE ODER ZWEI Fragen gleichzeitig.
2. KONTEXT: Beachte den bisherigen Chat-Verlauf.
3. ISO 9001 ANALYSE: Extrahiere Inputs, Outputs, Verantwortlichkeiten und Risiken. Schlage SET_ISO_FIELD Operationen vor.
4. STRUKTUR: Erstelle BPMN-ähnliche Strukturen mit 'start', 'end', 'step' und 'decision'.
5. OPERATIONEN: Du MUSST das exakte Schema für 'proposedOps' einhalten. 

WICHTIGE SYNTAX-REGELN:
- Jede Operation benötigt die Felder 'type' (String) und 'payload' (Object).
- Benutze NIEMALS 'action' anstelle von 'type'.
- Erstelle für JEDEN neuen Knoten eine eigene 'ADD_NODE' Operation. KEINE Batch-Arrays wie 'nodes: [...]'.
- 'payload' für 'ADD_NODE': { "node": { "id": string, "type": "step"|"decision"|"start"|"end", "title": string } }
- 'payload' für 'SET_ISO_FIELD': { "field": "inputs"|"outputs"|"risks"|"evidence", "value": string }

ANTWORT-FORMAT:
Du MUSST eine valide JSON-Antwort liefern mit exakt diesen Keys: "proposedOps", "explanation", "openQuestions".`;

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
    
    // Batch-Handling für 'add_nodes' oder 'nodes' Arrays
    if ((type === 'ADD_NODES' || type === 'ADD_NODE') && Array.isArray(op.nodes)) {
      op.nodes.forEach((n: any) => normalized.push({ type: 'ADD_NODE', payload: { node: n } }));
    } 
    else if ((type === 'ADD_NODES' || type === 'ADD_NODE') && op.payload?.nodes && Array.isArray(op.payload.nodes)) {
      op.payload.nodes.forEach((n: any) => normalized.push({ type: 'ADD_NODE', payload: { node: n } }));
    }
    // Batch-Handling für 'add_edges' oder 'edges' Arrays
    else if ((type === 'ADD_EDGES' || type === 'ADD_EDGE') && Array.isArray(op.edges)) {
      op.edges.forEach((e: any) => normalized.push({ 
        type: 'ADD_EDGE', 
        payload: { edge: { id: e.id || `e-${Math.random().toString(36).substr(2,5)}`, source: e.source || e.from, target: e.target || e.to, label: e.label || '' } } 
      }));
    }
    // Handling für 'set_iso_fields' mit Objekt-Payload
    else if ((type === 'SET_ISO_FIELDS' || type === 'SET_ISO_FIELD') && op.fields && typeof op.fields === 'object') {
      Object.entries(op.fields).forEach(([f, v]) => {
        normalized.push({ type: 'SET_ISO_FIELD', payload: { field: f, value: Array.isArray(v) ? v.join(', ') : String(v) } });
      });
    }
    // Standard-Fall
    else {
      normalized.push({
        type: type === 'ADD_NODES' ? 'ADD_NODE' : type,
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
    explanation: raw.explanation || raw.message || raw.summary || "Die KI hat Änderungen am Prozessmodell vorgeschlagen.",
    openQuestions: []
  };

  // Normalisiere Operations
  if (Array.isArray(raw.proposedOps)) {
    normalized.proposedOps = normalizeOps(raw.proposedOps);
  } else if (Array.isArray(raw.ops)) {
    normalized.proposedOps = normalizeOps(raw.ops);
  }

  // Normalisiere Questions (manche Modelle nutzen 'question' oder 'questions')
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

    const prompt = `CHAT-VERLAUF:
${historyString}

AKTUELLE ANWEISUNG VOM NUTZER: "${input.userMessage}"

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

    // Standard Genkit handling
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
    
    // Auch bei Standard-Modellen normalisieren wir zur Sicherheit
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
      explanation: `KI-Analyse unterbrochen: ${error.message || "Strukturfehler"}. Bitte versuchen Sie die Anweisung konkreter zu formulieren.`,
      openQuestions: ["Können Sie die letzte Anweisung bitte wiederholen?"]
    };
  }
}
