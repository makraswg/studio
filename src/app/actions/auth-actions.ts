'use server';

import { DataSource } from '@/context/settings-context';
import { dbQuery } from '@/lib/mysql';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { PlatformUser, Tenant } from '@/lib/types';
import bcrypt from 'bcryptjs';

/**
 * Simuliert eine LDAP-Authentifizierung basierend auf Mandanteneinstellungen.
 */
async function authenticateViaLdap(email: string, password: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const rows: any = await dbQuery('SELECT * FROM `tenants` WHERE `id` = ?', [tenantId]);

    const tenant = rows[0] as Tenant;
    if (!tenant || !tenant.ldapEnabled) {
      return { success: false, error: 'LDAP ist für diesen Mandanten nicht konfiguriert oder deaktiviert.' };
    }

    console.log(`[LDAP SIMULATION] Authentifiziere ${email} gegen ${tenant.ldapUrl}:${tenant.ldapPort}...`);
    // Simulation: Erfolg, wenn Passwort nicht 'wrong' ist.
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (password === 'wrong') {
      return { success: false, error: 'LDAP-Authentifizierung fehlgeschlagen: Ungültiges Passwort.' };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: `LDAP-Verbindungsfehler: ${e.message}` };
  }
}

/**
 * Authentifiziert einen Benutzer gegen die ausgewählte Datenquelle.
 */
export async function authenticateUserAction(dataSource: DataSource, email: string, password?: string): Promise<{ 
  success: boolean; 
  user?: PlatformUser; 
  error?: string 
}> {

  switch (dataSource) {
    case 'mysql':
      if (!password) return { success: false, error: 'Kein Passwort angegeben.' };
      return await authenticateViaMysql(email, password);

    case 'firestore':
      return await authenticateViaCloud(email);
      
    case 'mock':
      return await authenticateViaMock(email);

    default:
      return { success: false, error: 'Ungültige Datenquelle für Authentifizierung.' };
  }
}

async function authenticateViaMysql(email: string, password: string) {
  try {
    const rows: any = await dbQuery(
      'SELECT * FROM `platformUsers` WHERE `email` = ? AND `enabled` = 1', 
      [email]
    );

    if (!rows || rows.length === 0) {
      return { success: false, error: 'Benutzer nicht gefunden oder deaktiviert.' };
    }

    const user = rows[0];

    if (user.authSource === 'ldap') {
      const ldapResult = await authenticateViaLdap(email, password, user.tenantId);
      if (!ldapResult.success) return ldapResult;
      
      const { password: _, ...userWithoutPassword } = user;
      return { success: true, user: { ...userWithoutPassword, enabled: true } as PlatformUser };
    }

    if (!user.password) {
      return { success: false, error: 'Kein Passwort für diesen lokalen Benutzer hinterlegt.' };
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (isMatch) {
      const { password: _, ...userWithoutPassword } = user;
      const platformUser = {
        ...userWithoutPassword,
        enabled: userWithoutPassword.enabled === 1 || userWithoutPassword.enabled === true
      } as PlatformUser;
      return { success: true, user: platformUser };
    } else {
      return { success: false, error: 'Ungültiges Passwort.' };
    }
  } catch (error: any) {
    return { success: false, error: `Datenbank-Fehler: ${error.message}` };
  }
}

async function authenticateViaCloud(email: string) {
  try {
    const { firestore } = initializeFirebase();
    const q = query(
      collection(firestore, 'platformUsers'),
      where('email', '==', email),
      where('enabled', '==', true),
      limit(1)
    );
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'Benutzer nicht im zentralen Verzeichnis gefunden.' };
    }

    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as PlatformUser;
    
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: `Cloud-Fehler: ${error.message}` };
  }
}

async function authenticateViaMock(email: string) {
  try {
    const users = getMockCollection('platformUsers') as PlatformUser[];
    const user = users.find(u => u.email === email && u.enabled);

    if (user) {
      return { success: true, user };
    } else {
      return { success: false, error: 'Benutzer nicht in den Demo-Daten gefunden.' };
    }
  } catch (error: any) {
    return { success: false, error: `Fehler bei Demo-Daten: ${error.message}` };
  }
}
