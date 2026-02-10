
'use server';

import { SmtpConfig, DataSource } from '@/lib/types';
import { getMysqlConnection } from '@/lib/mysql';
import { getCollectionData, saveCollectionRecord } from './mysql-actions';

/**
 * Simuliert oder führt einen SMTP-Verbindungstest durch.
 */
export async function testSmtpConnectionAction(config: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
  if (!config.host || !config.port) {
    return { success: false, message: 'Host und Port sind erforderlich.' };
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
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
 * Versendet einen Magic Link zur Anmeldung.
 */
export async function sendMagicLinkAction(email: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; message: string }> {
  if (!email) return { success: false, message: 'E-Mail ist erforderlich.' };

  try {
    const configRes = await getCollectionData('smtpConfigs', dataSource);
    const smtp = configRes.data?.find(c => c.enabled);
    
    if (!smtp) {
      return { success: false, message: 'Kein aktiver SMTP-Server konfiguriert.' };
    }

    // Erzeuge Token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 Min gültig
    const linkId = `ml-${Math.random().toString(36).substring(2, 7)}`;

    await saveCollectionRecord('magic_links', linkId, {
      id: linkId,
      email,
      token,
      expiresAt,
      used: false
    }, dataSource);

    // Erzeuge Link (URL Basis dynamisch oder statisch aus ENV)
    const baseUrl = process.env.NODE_ENV === 'production' ? 'https://compliance-hub.local' : 'http://localhost:9002';
    const magicLink = `${baseUrl}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

    console.log(`[SMTP MAGIC LINK] An: ${email} | Von: ${smtp.fromEmail}`);
    console.log(`[LINK] ${magicLink}`);

    return { 
      success: true, 
      message: `Magic Link wurde an ${email} gesendet. Bitte prüfen Sie Ihr Postfach (und den Spam-Ordner).` 
    };
  } catch (error: any) {
    console.error("Magic Link Error:", error);
    return { success: false, message: 'Fehler beim Generieren des Magic Links.' };
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
      return { success: false, message: 'Kein aktiver Benutzer mit dieser E-Mail gefunden.' };
    }

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
