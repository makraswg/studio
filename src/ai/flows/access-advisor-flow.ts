
'use server';
/**
 * @fileOverview AI Access Advisor Flow.
 * 
 * This flow analyzes a user's current entitlements and assignments within a tenant
 * to provide a risk assessment and recommendations for access optimization.
 * It dynamically switches between Gemini and Ollama based on the configuration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getActiveAiConfig } from '@/app/actions/ai-actions';
import { ollama } from 'genkitx-ollama';
import { googleAI } from '@genkit-ai/google-genai';
import { DataSource } from '@/lib/types';

const AccessAdvisorInputSchema = z.object({
  userDisplayName: z.string(),
  userEmail: z.string(),
  department: z.string(),
  assignments: z.array(z.object({
    resourceName: z.string(),
    entitlementName: z.string(),
    riskLevel: z.string(),
  })),
  dataSource: z.enum(['mysql', 'firestore', 'mock']).optional(),
});

export type AccessAdvisorInput = z.infer<typeof AccessAdvisorInputSchema>;

const AccessAdvisorOutputSchema = z.object({
  riskScore: z.number().describe('A score from 0-100 indicating access risk.'),
  summary: z.string().describe('A brief overview of the user\'s access profile.'),
  concerns: z.array(z.string()).describe('Specific high-risk areas identified.'),
  recommendations: z.array(z.string()).describe('Actionable steps to improve security.'),
});

export type AccessAdvisorOutput = z.infer<typeof AccessAdvisorOutputSchema>;

const SYSTEM_PROMPT = `You are an expert Identity and Access Management (IAM) security advisor.
Analyze the following user's access profile and provide a professional risk assessment.

Identify if there are too many high-risk permissions, if the access matches the department (Principle of Least Privilege), and suggest revoking stale or unnecessary access.`;

/**
 * Dynamically selects the model based on database configuration.
 */
async function getAdvisorModel(dataSource: DataSource = 'mysql') {
  const config = await getActiveAiConfig(dataSource);
  
  if (config && config.provider === 'ollama' && config.enabled) {
    return ollama.model(config.ollamaModel || 'llama3');
  }
  
  // Default to Gemini
  return googleAI.model(config?.geminiModel || 'gemini-2.5-flash');
}

export async function getAccessAdvice(input: AccessAdvisorInput): Promise<AccessAdvisorOutput> {
  const model = await getAdvisorModel(input.dataSource as DataSource);
  
  const assignmentsList = input.assignments
    .map(a => `- Resource: ${a.resourceName}, Entitlement: ${a.entitlementName}, Risk: ${a.riskLevel}`)
    .join('\n');

  const prompt = `User: ${input.userDisplayName} (${input.userEmail})
Department: ${input.department}

Current Assignments:
${assignmentsList}`;

  try {
    const { output } = await ai.generate({
      model,
      system: SYSTEM_PROMPT,
      prompt,
      output: { schema: AccessAdvisorOutputSchema }
    });

    if (!output) throw new Error('AI failed to generate advice.');
    return output;
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    // Fallback for UI stability
    return {
      riskScore: 50,
      summary: "Fehler bei der KI-Analyse. Bitte prüfen Sie die Verbindung zum KI-Provider (Ollama/Gemini) in den Einstellungen.",
      concerns: ["Verbindung zum KI-Dienst fehlgeschlagen"],
      recommendations: ["KI-Einstellungen in der Konsole prüfen", "Manueller Review erforderlich"]
    };
  }
}
