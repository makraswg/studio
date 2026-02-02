'use client';

import { useState, useEffect, useRef } from 'react';
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

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: Error | null; // Error object, or null.
}

/**
 * Custom hook to listen to a Firestore collection.
 * @template T Type of the document data.
 */
export function useCollection<T>(
  targetRefOrQuery: Query<T, DocumentData> | CollectionReference<T, DocumentData> | null,
  options?: { includeMetadataChanges?: boolean }
): UseCollectionResult<T> {
  // Stabilize the query reference
  const memoizedTargetRefOrQuery = useMemoFirebase(
    () => targetRefOrQuery,
    [targetRefOrQuery]
  );

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedTargetRefOrQuery);
  const [error, setError] = useState<Error | null>(null);
  
  // Guard against state updates on unmounted components which can trigger SDK assertion errors
  const isMounted = useRef(true);
  const activeUnsubscribe = useRef<(() => void) | null>(null);

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

    // Ensure we don't have multiple listeners if useEffect runs again before cleanup
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
          // Resolve path safely
          let path = 'collection-group-query';
          if ('path' in memoizedTargetRefOrQuery) {
             path = (memoizedTargetRefOrQuery as any).path;
          } else if ('_query' in (memoizedTargetRefOrQuery as any)) {
             path = (memoizedTargetRefOrQuery as any)._query.path.canonicalString();
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
  }, [memoizedTargetRefOrQuery, options?.includeMetadataChanges]);

  return { data, isLoading, error };
}
