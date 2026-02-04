
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

/**
 * Ein Hook, um Daten aus einer MySQL-Datenbank zu laden.
 * Implementiert Polling für "Near Real-time" Updates.
 */
export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    const result = await getCollectionData(collectionName);

    if (result.error) {
      setError(result.error);
      if (!silent) setData(null);
    } else {
      setData(result.data as T[]);
    }
    if (!silent) setIsLoading(false);
  }, [collectionName]);

  const refresh = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setData(null);
      setError(null);
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
      return;
    }

    // Initial fetch
    fetchData();

    // Start polling every 10 seconds for "near real-time" experience
    pollingInterval.current = setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [enabled, version, fetchData]);

  return { data, isLoading, error, refresh };
}
