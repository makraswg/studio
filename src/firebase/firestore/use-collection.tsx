'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useMemoFirebase } from '@/firebase';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCollection<T>(
  targetRefOrQuery: Query<T, DocumentData> | CollectionReference<T, DocumentData> | null,
  options?: { includeMetadataChanges?: boolean }
): UseCollectionResult<T> {
  const memoizedTargetRefOrQuery = useMemoFirebase(
    () => targetRefOrQuery,
    [targetRefOrQuery]
  );

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedTargetRefOrQuery);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const isMounted = useRef(true);
  const activeUnsubscribe = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (activeUnsubscribe.current) {
      activeUnsubscribe.current();
    }

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      { includeMetadataChanges: options?.includeMetadataChanges },
      (snapshot: QuerySnapshot<T, DocumentData>) => {
        if (!isMounted.current) return;
        
        const docs = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        setData(docs);
        setIsLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        if (!isMounted.current) return;

        if (err.code === 'permission-denied') {
          let path = 'unknown-path';
          try {
            if ('path' in (memoizedTargetRefOrQuery as any)) {
              path = (memoizedTargetRefOrQuery as any).path;
            } else if ((memoizedTargetRefOrQuery as any)._query?.path?.canonicalString) {
              path = (memoizedTargetRefOrQuery as any)._query.path.canonicalString();
            }
          } catch (e) {
            console.warn("Failed to resolve path for error reporting", e);
          }

          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: path,
          });
          
          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } else {
          setError(err);
        }
        setIsLoading(false);
      }
    );

    activeUnsubscribe.current = unsubscribe;

    return () => {
      isMounted.current = false;
      if (activeUnsubscribe.current) {
        activeUnsubscribe.current();
        activeUnsubscribe.current = null;
      }
    };
  }, [memoizedTargetRefOrQuery, options?.includeMetadataChanges, refreshKey]);

  return { data, isLoading, error, refresh };
}
