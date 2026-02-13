
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

/**
 * Globaler Store zur Synchronisierung des Zustands über alle Instanzen hinweg.
 * Implementiert Stale-While-Revalidate (SWR) Verhalten.
 */
const globalStore: Record<string, {
  data: any[] | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: number;
  subscribers: Set<(state: any) => void>;
}> = {};

export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  if (!globalStore[collectionName]) {
    globalStore[collectionName] = {
      data: null,
      isLoading: false,
      error: null,
      lastFetch: 0,
      subscribers: new Set(),
    };
  }

  const [localState, setLocalState] = useState({
    data: globalStore[collectionName].data,
    isLoading: globalStore[collectionName].isLoading,
    error: globalStore[collectionName].error
  });

  const isMounted = useRef(true);

  const notify = useCallback(() => {
    const currentState = {
      data: globalStore[collectionName].data,
      isLoading: globalStore[collectionName].isLoading,
      error: globalStore[collectionName].error
    };
    globalStore[collectionName].subscribers.forEach(sub => sub(currentState));
  }, [collectionName]);

  const fetchData = useCallback(async (force = false) => {
    const store = globalStore[collectionName];
    if (store.isLoading && !force) return;
    
    // Verhindere zu häufige Refreshes (5s Throttling)
    const now = Date.now();
    if (store.data && !force && (now - store.lastFetch < 5000)) return;

    store.isLoading = true;
    notify();

    try {
      const result = await getCollectionData(collectionName);
      if (!isMounted.current) return;

      if (result.error) {
        store.error = result.error;
      } else {
        store.data = result.data || [];
        store.error = null;
        store.lastFetch = now;
      }
    } catch (e: any) {
      store.error = e.message || "Fetch failed";
    } finally {
      store.isLoading = false;
      notify();
    }
  }, [collectionName, notify]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled) return;

    const store = globalStore[collectionName];
    const updateLocal = (newState: any) => {
      if (isMounted.current) setLocalState(newState);
    };

    store.subscribers.add(updateLocal);
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
