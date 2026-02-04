'use server';

import { saveCollectionRecord } from './mysql-actions';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Erstellt einen Audit-Eintrag in der aktuell aktiven Datenquelle.
 */
export async function logAuditEventAction(
  dataSource: 'firestore' | 'mysql' | 'mock',
  event: {
    tenantId: string;
    actorUid: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: any;
    after?: any;
  }
) {
  const eventId = `audit-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  const auditData = {
    ...event,
    id: eventId,
    timestamp
  };

  try {
    if (dataSource === 'mysql') {
      await saveCollectionRecord('auditEvents', eventId, auditData);
    } else if (dataSource === 'firestore') {
      const { firestore } = initializeFirebase();
      const docRef = doc(firestore, 'auditEvents', eventId);
      await setDoc(docRef, auditData);
    }
    // Mock-Modus benötigt kein persistentes Logging
    return { success: true };
  } catch (e) {
    console.error("Audit Logging failed:", e);
    return { success: false };
  }
}
