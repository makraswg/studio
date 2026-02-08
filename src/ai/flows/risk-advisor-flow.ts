'use server';
/**
 * @fileOverview AI Risk Advisor Flow.
 * Analyzes a risk scenario and suggests mitigation measures.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getActiveAiConfig, getCompanyContext } from '@/app/actions/ai-actions';
import { DataSource } from '@/lib/types';
import OpenAI from 'openai';

const RiskAdvisorInputSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  impact: z.number(),
  probability: z.number(),
  assetName: z.string().optional(),
  tenantId: z.string().optional(),
  dataSource: z.enum(['mysql', 'firestore', 'mock']).optional(),
});

export type RiskAdvisorInput = z.infer<typeof RiskAdvisorInputSchema>;

const RiskAdvisorOutputSchema = z.object({
  assessment: z.string().describe('Analytical assessment of the risk scenario.'),
  threatLevel: z.enum(['low', 'medium', 'high', 'critical']),
  measures: z.array(z.string()).describe('Suggested mitigation measures.'),
  gapAnalysis: z.string().describe('Identification of potential missing controls.'),
});

export type RiskAdvisorOutput = z.infer<typeof RiskAdvisorOutputSchema>;

const SYSTEM_PROMPT = `You are an expert GRC (Governance, Risk, and Compliance) advisor specializing in ISO 27001 and BSI IT-Grundschutz.
Analyze the provided risk scenario and provide a professional advisory report.

COMPANY CONTEXT:
{{{companyDescription}}}

Focus on:
1. Impact on business operations.
2. Compliance implications (GDPR, Security laws).
3. Practical, state-of-the-art mitigation measures.

Return your response as a valid JSON object in German:
{
  "assessment": "Analytische Bewertung",
  "threatLevel": "low|medium|high|critical",
  "measures": ["Maßnahme 1", "Maßnahme 2"],
  "gapAnalysis": "Lückenanalyse"
}`;

/**
 * The main Flow definition for Risk Advice.
 */
const riskAdvisorFlow = ai.defineFlow(
  {
    name: 'riskAdvisorFlow',
    inputSchema: RiskAdvisorInputSchema,
    outputSchema: RiskAdvisorOutputSchema,
  },
  async (input) => {
    const config = await getActiveAiConfig(input.dataSource as DataSource);
    const companyDescription = await getCompanyContext(input.tenantId || '', input.dataSource as DataSource);
    
    const systemPromptPopulated = SYSTEM_PROMPT.replace('{{{companyDescription}}}', companyDescription || 'Allgemeiner KMU-Kontext.');

    const prompt = `RISIKO-SZENARIO:
Titel: ${input.title}
Kategorie: ${input.category}
Beschreibung: ${input.description}
System/Asset: ${input.assetName || 'Global'}
Bewertung: Impact ${input.impact}/5, Wahrscheinlichkeit ${input.probability}/5 (Score: ${input.impact * input.probability})`;

    // Handling OpenRouter
    if (config?.provider === 'openrouter') {
      const client = new OpenAI({
        apiKey: config.openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
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
      if (!content) throw new Error('AI failed to generate risk advice.');
      return JSON.parse(content) as RiskAdvisorOutput;
    }

    // Standard Genkit
    const modelIdentifier = config?.provider === 'ollama' 
      ? `ollama/${config.ollamaModel || 'llama3'}` 
      : `googleai/${config?.geminiModel || 'gemini-1.5-flash'}`;

    const { output } = await ai.generate({
      model: modelIdentifier,
      system: systemPromptPopulated,
      prompt,
      output: { schema: RiskAdvisorOutputSchema }
    });

    if (!output) throw new Error('AI failed to generate risk advice.');
    return output;
  }
);

/**
 * Public wrapper function.
 */
export async function getRiskAdvice(input: RiskAdvisorInput): Promise<RiskAdvisorOutput> {
  try {
    return await riskAdvisorFlow(input);
  } catch (error: any) {
    console.error("Risk Advisor Error:", error);
    return {
      assessment: "Fehler bei der KI-Analyse. Bitte prüfen Sie die Provider-Konfiguration.",
      threatLevel: "medium",
      measures: ["Manueller Maßnahmenplan erforderlich"],
      gapAnalysis: "Konnektivität zum KI-Dienst fehlgeschlagen."
    };
  }
}
