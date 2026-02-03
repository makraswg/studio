"use client";

import { useCollection as useFirestoreCollection, UseCollectionResult } from '@/firebase/firestore/use-collection';
import { useMockCollection } from '@/hooks/data/use-mock-collection';
import { useMysqlCollection } from '@/hooks/data/use-mysql-collection';
import { Document } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { useFirestore } from '@/firebase';
import { collection, CollectionReference, DocumentData } from 'firebase/firestore';
import { useMemo } from 'react';

/**
 * Ein austauschbarer Daten-Hook, der je nach globalen Einstellungen die Datenquelle wählt.
 * Erstellt eine korrekte CollectionReference für Firestore oder nutzt MySQL/Mock Hooks.
 */
export function usePluggableCollection<T extends Document>(collectionName: string): UseCollectionResult<T> {
  const { dataSource } = useSettings();
  const db = useFirestore();

  // Erstellt eine memoisierte Collection-Referenz für Firestore.
  const collectionRef = useMemo(() => {
    if (dataSource === 'firestore' && db) {
      return collection(db, collectionName) as CollectionReference<T, DocumentData>;
    }
    return null;
  }, [dataSource, db, collectionName]);

  // Firestore Hook (Real-time onSnapshot)
  const firestoreResult = useFirestoreCollection<T>(collectionRef);
  
  // MySQL Hook
  const mysqlResult = useMysqlCollection<T>(collectionName, dataSource === 'mysql');
  
  // Mock Hook
  const mockResult = useMockCollection<T>(collectionName, { disabled: dataSource !== 'mock' });

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
