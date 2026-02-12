
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

/**
 * Global store to synchronize collection state across all hook instances.
 * Implements a stale-while-revalidate pattern for immediate UI response.
 */
const globalStore: Record<string, {
  data: any[] | null;
  isLoading: boolean;
  error: string | null;
  promise: Promise<any> | null;
  subscribers: Set<(state: any) => void>;
}> = {};

export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  // Initialize store for this collection if it doesn't exist
  if (!globalStore[collectionName]) {
    globalStore[collectionName] = {
      data: null,
      isLoading: false,
      error: null,
      promise: null,
      subscribers: new Set(),
    };
  }

  const [localState, setLocalState] = useState({
    data: globalStore[collectionName].data,
    isLoading: globalStore[collectionName].isLoading,
    error: globalStore[collectionName].error
  });

  const isMounted = useRef(true);

  const notifySubscribers = useCallback(() => {
    const currentState = {
      data: globalStore[collectionName].data,
      isLoading: globalStore[collectionName].isLoading,
      error: globalStore[collectionName].error
    };
    globalStore[collectionName].subscribers.forEach(sub => sub(currentState));
  }, [collectionName]);

  const fetchData = useCallback(async (force = false) => {
    const store = globalStore[collectionName];
    
    // If already loading and not forced, wait for existing promise
    if (store.isLoading && !force) return;
    
    // If data exists and not forced, don't fetch
    if (store.data && !force) return;

    store.isLoading = true;
    store.error = null;
    notifySubscribers();

    try {
      store.promise = getCollectionData(collectionName);
      const result = await store.promise;
      
      if (!isMounted.current) return;

      if (result.error) {
        store.error = result.error;
      } else {
        store.data = (result.data || []) as any[];
        store.error = null;
      }
    } catch (e: any) {
      store.error = e.message || "Datenbankfehler";
    } finally {
      store.isLoading = false;
      store.promise = null;
      notifySubscribers();
    }
  }, [collectionName, notifySubscribers]);

  const refresh = useCallback(() => {
    // We DON'T clear data here to keep the UI stable (stale-while-revalidate)
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled) return;

    const store = globalStore[collectionName];
    const updateLocal = (newState: any) => {
      if (isMounted.current) {
        setLocalState(prev => {
          // Optimization: avoid re-renders if content is identical
          if (JSON.stringify(prev) === JSON.stringify(newState)) return prev;
          return newState;
        });
      }
    };

    store.subscribers.add(updateLocal);
    
    // Initial fetch if needed
    fetchData();

    return () => {
      isMounted.current = false;
      store.subscribers.delete(updateLocal);
    };
  }, [collectionName, enabled, fetchData]);

  return useMemo(() => ({
    data: localState.data as T[] | null,
    isLoading: localState.isLoading,
    error: localState.error ? new Error(localState.error) : null,
    refresh
  }), [localState, refresh]);
}
