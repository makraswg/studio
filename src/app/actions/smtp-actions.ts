
'use server';

import { SmtpConfig } from '@/lib/types';
import { getMysqlConnection } from '@/lib/mysql';

/**
 * Simuliert oder führt einen SMTP-Verbindungstest durch.
 * In einer realen Umgebung würde hier z.B. 'nodemailer' verwendet werden.
 */
export async function testSmtpConnectionAction(config: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
  if (!config.host || !config.port) {
    return { success: false, message: 'Host und Port sind erforderlich.' };
  }

  // Simulation einer Netzwerkprüfung
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Einfache Validierung der Eingaben
    if (config.host.includes('localhost') || config.host.includes('127.0.0.1')) {
      return { success: false, message: 'Lokale Hosts werden in dieser Sandbox nicht unterstützt.' };
    }

    return { 
      success: true, 
      message: `Verbindung zu ${config.host}:${config.port} erfolgreich (Simuliert).` 
    };
  } catch (e: any) {
    return { success: false, message: `Verbindungsfehler: ${e.message}` };
  }
}

/**
 * Bearbeitet eine "Passwort vergessen" Anfrage.
 */
export async function requestPasswordResetAction(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) return { success: false, message: 'E-Mail ist erforderlich.' };

  try {
    const connection = await getMysqlConnection();
    const [rows]: any = await connection.execute(
      'SELECT id, displayName FROM `platformUsers` WHERE `email` = ? AND `enabled` = 1', 
      [email]
    );
    connection.release();

    if (!rows || rows.length === 0) {
      // Aus Sicherheitsgründen geben wir oft trotzdem eine generische Erfolgsmeldung zurück,
      // um "User Enumeration" zu verhindern. Hier im Prototyp sind wir ehrlich.
      return { success: false, message: 'Kein aktiver Benutzer mit dieser E-Mail gefunden.' };
    }

    // Hier würde nun die E-Mail via SMTP versendet werden.
    // Da wir nodemailer nicht installiert haben, simulieren wir den Erfolg.
    console.log(`[SMTP SIMULATION] Sende Passwort-Reset an ${email} für User ${rows[0].displayName}`);

    return { 
      success: true, 
      message: `Anleitung zum Zurücksetzen wurde an ${email} gesendet (Simuliert).` 
    };
  } catch (error: any) {
    console.error("Reset Error:", error);
    return { success: false, message: 'Datenbank- oder Serverfehler.' };
  }
}
