'use server';

import { DataSource } from '@/context/settings-context';
import { getMysqlConnection } from '@/lib/mysql';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { PlatformUser } from '@/lib/types';
import bcrypt from 'bcryptjs';

/**
 * Authentifiziert einen Benutzer gegen die ausgewählte Datenquelle.
 * Diese Funktion ist die zentrale Logik für den Plattform-Login.
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
      // Firestore-Login prüft hier nur die Existenz in der platformUsers Sammlung.
      return await authenticateViaFirestore(email);
      
    case 'mock':
      // Mock-Login prüft ebenfalls nur die Existenz.
      return await authenticateViaMock(email);

    default:
      return { success: false, error: 'Ungültige Datenquelle für Authentifizierung.' };
  }
}

// --- MySQL Authentifizierungslogik ---
async function authenticateViaMysql(email: string, password: string) {
  let connection;
  try {
    connection = await getMysqlConnection();
    const [rows]: any = await connection.execute(
      'SELECT * FROM `platformUsers` WHERE `email` = ? AND `enabled` = 1', 
      [email]
    );
    connection.release();

    if (!rows || rows.length === 0) {
      return { success: false, error: 'Benutzer nicht gefunden oder deaktiviert.' };
    }

    const user = rows[0];
    if (!user.password) {
      return { success: false, error: 'Kein Passwort für diesen Benutzer hinterlegt.' };
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (isMatch) {
      const { password: _, ...userWithoutPassword } = user;
      // Konvertiere numerische Booleans aus MySQL sicher
      const platformUser = {
        ...userWithoutPassword,
        enabled: userWithoutPassword.enabled === 1 || userWithoutPassword.enabled === true
      } as PlatformUser;
      return { success: true, user: platformUser };
    } else {
      return { success: false, error: 'Ungültiges Passwort.' };
    }
  } catch (error: any) {
    if (connection) connection.release();
    return { success: false, error: `Datenbank-Fehler: ${error.message}` };
  }
}

// --- Firestore Authentifizierungslogik ---
async function authenticateViaFirestore(email: string) {
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
      return { success: false, error: 'Benutzer nicht in der Plattform-Datenbank gefunden oder deaktiviert.' };
    }

    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as PlatformUser;
    
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: `Firestore-Fehler: ${error.message}` };
  }
}

// --- Mock-Daten Authentifizierungslogik ---
async function authenticateViaMock(email: string) {
  try {
    const users = getMockCollection('platformUsers') as PlatformUser[];
    const user = users.find(u => u.email === email && u.enabled);

    if (user) {
      return { success: true, user };
    } else {
      return { success: false, error: 'Benutzer nicht in den Mock-Daten gefunden oder deaktiviert.' };
    }
  } catch (error: any) {
    return { success: false, error: `Fehler bei Mock-Daten: ${error.message}` };
  }
}
