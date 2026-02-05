
"use client";

import { useMemo } from 'react';
import { collection, CollectionReference, DocumentData } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useCollection as useFirestoreCollection, UseCollectionResult } from '@/firebase/firestore/use-collection';
import { useMockCollection } from '@/hooks/data/use-mock-collection';
import { useMysqlCollection } from '@/hooks/data/use-mysql-collection';
import { useSettings } from '@/context/settings-context';
import { Document } from '@/lib/types';

/**
 * Der zentrale, hochperformante Daten-Hook der Anwendung. 
 * Er stellt sicher, dass nur die aktuell aktive Datenquelle Ressourcen verbraucht.
 */
export function usePluggableCollection<T extends Document>(collectionName: string): UseCollectionResult<T> {
  const { dataSource } = useSettings();
  const db = useFirestore();

  // Erstellt eine memoisierte Collection-Referenz für Firestore.
  // Diese ist nur gesetzt, wenn Firestore die aktive Quelle ist.
  const collectionRef = useMemo(() => {
    if (dataSource === 'firestore' && db) {
      return collection(db, collectionName) as CollectionReference<T, DocumentData>;
    }
    return null;
  }, [dataSource, db, collectionName]);

  // Wir instanziieren die Hooks. Die Hooks selbst prüfen intern auf 'enabled'
  // und bleiben inert, wenn sie nicht benötigt werden.
  const firestoreResult = useFirestoreCollection<T>(collectionRef);
  const mysqlResult = useMysqlCollection<T>(collectionName, dataSource === 'mysql');
  const mockResult = useMockCollection<T>(collectionName, { disabled: dataSource !== 'mock' });

  // Rückgabe der Daten basierend auf der aktiven Quelle.
  // Durch useMemo wird das Rückgabeobjekt stabil gehalten.
  return useMemo(() => {
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
  }, [dataSource, firestoreResult, mysqlResult, mockResult]);
}
