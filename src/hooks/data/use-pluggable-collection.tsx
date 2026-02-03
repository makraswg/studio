
"use client";

import { useCollection as useFirestoreCollection, UseCollectionResult } from '@/firebase/firestore/use-collection';
import { useMockCollection } from '@/hooks/data/use-mock-collection';
import { Document } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { useFirestore } from '@/firebase';
import { collection, CollectionReference, DocumentData } from 'firebase/firestore';
import { useMemo } from 'react';

/**
 * Ein austauschbarer Daten-Hook, der je nach globalen Einstellungen die Datenquelle wählt.
 * Erstellt eine korrekte CollectionReference für Firestore oder deaktiviert den Hook.
 */
export function usePluggableCollection<T extends Document>(collectionName: string): UseCollectionResult<T> {
  const { dataSource } = useSettings();
  const db = useFirestore();

  // Erstellt eine memoisierte Collection-Referenz für Firestore.
  // Diese ist `null`, wenn die Datenquelle nicht 'firestore' ist.
  const collectionRef = useMemo(() => {
    if (dataSource === 'firestore' && db) {
      return collection(db, collectionName) as CollectionReference<T, DocumentData>;
    }
    return null;
  }, [dataSource, db, collectionName]);

  // useFirestoreCollection wird jetzt korrekt mit einer Referenz oder `null` aufgerufen.
  // Wenn die Referenz `null` ist, tut der Hook nichts.
  const firestoreResult = useFirestoreCollection<T>(collectionRef);
  
  // useMockCollection wird deaktiviert, wenn die Datenquelle nicht 'mock' ist.
  const mockResult = useMockCollection<T>(collectionName, { disabled: dataSource !== 'mock' });

  // Gibt das Ergebnis basierend auf der ausgewählten Datenquelle zurück.
  if (dataSource === 'firestore') {
    return firestoreResult;
  } else {
    return mockResult;
  }
}
