'use server';

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { DataSource } from '@/lib/types';
import { getCollectionData, saveCollectionRecord } from './mysql-actions';

/**
 * Erstellt ein neues TOTP Geheimnis für einen Benutzer.
 */
export async function setupTotpAction(userId: string, email: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; secret?: string; qrCode?: string; error?: string }> {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'ComplianceHub', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    return { success: true, secret, qrCode };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Verifiziert einen TOTP Code und aktiviert 2FA für den Benutzer.
 */
export async function verifyAndEnableTotpAction(userId: string, secret: string, code: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error?: string }> {
  try {
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) return { success: false, error: 'Ungültiger Code. Bitte prüfen Sie die Uhrzeit auf Ihrem Gerät.' };

    const userRes = await getCollectionData('platformUsers', dataSource);
    const user = userRes.data?.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Benutzer nicht gefunden.' };

    await saveCollectionRecord('platformUsers', userId, {
      ...user,
      totpSecret: secret,
      totpEnabled: true
    }, dataSource);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Deaktiviert 2FA für einen Benutzer.
 */
export async function disableTotpAction(userId: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error?: string }> {
  try {
    const userRes = await getCollectionData('platformUsers', dataSource);
    const user = userRes.data?.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Benutzer nicht gefunden.' };

    await saveCollectionRecord('platformUsers', userId, {
      ...user,
      totpSecret: null,
      totpEnabled: false
    }, dataSource);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Verifiziert einen TOTP Code während des Logins.
 */
export async function verifyTotpLoginAction(email: string, code: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const userRes = await getCollectionData('platformUsers', dataSource);
    const user = userRes.data?.find(u => u.email === email && u.enabled);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return { success: false, error: 'Zwei-Faktor-Authentifizierung nicht aktiv oder Benutzer ungültig.' };
    }

    const isValid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!isValid) return { success: false, error: 'Ungültiger Code.' };

    const { password: _, totpSecret: __, ...userWithoutSecrets } = user;
    return { success: true, user: userWithoutSecrets };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
