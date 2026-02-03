
"use client";

import { useEffect, useState } from 'react';
import { UseCollectionResult, WithId } from '@/firebase/firestore/use-collection';
import { Document } from '@/lib/types';
import { getMockCollection } from '@/lib/mock-db';

/**
 * A hook that loads a data collection from the static mock DB.
 * @param collectionName The name of the collection in the mock DB.
 * @param options.disabled If true, the hook will not run.
 */
export function useMockCollection<T extends Document>(
    collectionName: string,
    options?: { disabled?: boolean }
): UseCollectionResult<T> {
  const [result, setResult] = useState<UseCollectionResult<T>>({ data: null, isLoading: !options?.disabled, error: null });

  useEffect(() => {
    if (options?.disabled) {
        setResult({ data: null, isLoading: false, error: null });
        return;
    }

    setResult({ data: null, isLoading: true, error: null });
    try {
      // getMockCollection returns data that already includes an ID.
      const data = getMockCollection(collectionName) as WithId<T>[];
      
      setTimeout(() => {
        setResult({ data, isLoading: false, error: null });
      }, 300);
    } catch (e: any) {
      console.error("Error loading mock data:", e);
      setResult({ data: null, isLoading: false, error: new Error(`Error loading mock data for: ${collectionName}`) });
    }
  }, [collectionName, options?.disabled]);

  return result;
}
