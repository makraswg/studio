
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
 * Central data hook. Switches between MySQL, Firestore and Mock data based on settings.
 * Returns a stable result object.
 */
export function usePluggableCollection<T extends Document>(collectionName: string): UseCollectionResult<T> {
  const { dataSource } = useSettings();
  const db = useFirestore();

  const isFirestore = dataSource === 'firestore';
  const isMysql = dataSource === 'mysql';
  const isMock = dataSource === 'mock';

  const collectionRef = useMemo(() => {
    if (isFirestore && db) {
      return collection(db, collectionName) as CollectionReference<T, DocumentData>;
    }
    return null;
  }, [isFirestore, db, collectionName]);

  const firestoreResult = useFirestoreCollection<T>(collectionRef);
  const mysqlResult = useMysqlCollection<T>(collectionName, isMysql);
  const mockResult = useMockCollection<T>(collectionName, { disabled: !isMock });

  return useMemo(() => {
    if (isFirestore) {
      return firestoreResult;
    } else if (isMysql) {
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
  }, [isFirestore, isMysql, isMock, firestoreResult, mysqlResult, mockResult]);
}
