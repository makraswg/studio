
"use client";

import { useMemo } from 'react';
import { collection, CollectionReference, DocumentData } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useCollection as useFirestoreCollection, UseCollectionResult } from '@/firebase/firestore/use-collection';
import { useMockCollection } from '@/hooks/data/use-mock-collection';
import { useMysqlCollection } from '@/hooks/data/use-mysql-collection';
import { useSettings } from '@/context/settings-context';

/**
 * Der zentrale Daten-Hook der Anwendung. Er wählt basierend auf der 
 * globalen Einstellung (Firestore, MySQL oder Mock) die richtige Datenquelle.
 */
export function usePluggableCollection<T>(collectionName: string): UseCollectionResult<T> {
  const { dataSource } = useSettings();
  const db = useFirestore();

  // Erstellt eine memoisierte Collection-Referenz für Firestore.
  const collectionRef = useMemo(() => {
    if (dataSource === 'firestore' && db) {
      return collection(db, collectionName) as CollectionReference<T, DocumentData>;
    }
    return null;
  }, [dataSource, db, collectionName]);

  // Wir rufen alle Hooks auf, aber nur der aktive wird tatsächlich Daten laden.
  const firestoreResult = useFirestoreCollection<T>(collectionRef);
  const mysqlResult = useMysqlCollection<T>(collectionName, dataSource === 'mysql');
  const mockResult = useMockCollection<T>(collectionName as any, { disabled: dataSource !== 'mock' });

  // Gibt das Ergebnis basierend auf der ausgewählten Datenquelle zurück.
  if (dataSource === 'firestore') {
    return firestoreResult;
  } else if (dataSource === 'mysql') {
    return {
      data: mysqlResult.data ? (mysqlResult.data as any) : null,
      isLoading: mysqlResult.isLoading,
      error: mysqlResult.error ? new Error(mysqlResult.error) : null,
      refresh: mysqlResult.refresh
    } as UseCollectionResult<T>;
  } else {
    return {
      data: mockResult.data ? (mockResult.data as any) : null,
      isLoading: mockResult.isLoading,
      error: mockResult.error ? new Error(mockResult.error) : null,
      refresh: mockResult.refresh
    } as UseCollectionResult<T>;
  }
}
