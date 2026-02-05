
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

// Globaler Cache für MySQL-Daten, um unnötige Re-Fetches beim Seitenwechsel zu vermeiden.
const mysqlCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL = 5000; // 5 Sekunden Cache-Gültigkeit für Navigationen

/**
 * Ein optimierter Hook, um Daten aus einer MySQL-Datenbank zu laden.
 * Implementiert Caching und intelligentes Polling.
 */
export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(() => {
    const cached = mysqlCache[collectionName];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return cached.data as T[];
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(enabled && !data);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialFetch = useRef(true);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return;
    
    // Cache-Check nur beim initialen Laden oder manuellen Refresh (silent = false)
    if (isInitialFetch.current && !silent) {
      const cached = mysqlCache[collectionName];
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && data) {
        setIsLoading(false);
        isInitialFetch.current = false;
        return;
      }
    }

    if (!silent && !data) setIsLoading(true);
    
    try {
      const result = await getCollectionData(collectionName);
      if (result.error) {
        setError(result.error);
      } else {
        const newData = result.data as T[];
        setData(newData);
        setError(null);
        mysqlCache[collectionName] = { data: newData, timestamp: Date.now() };
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!silent) setIsLoading(false);
      isInitialFetch.current = false;
    }
  }, [collectionName, enabled]); // data wurde als Abhängigkeit entfernt, um Loop zu verhindern

  const refresh = useCallback(() => {
    delete mysqlCache[collectionName];
    isInitialFetch.current = true;
    setVersion(v => v + 1);
  }, [collectionName]);

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

    fetchData();

    const startPolling = () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      pollingInterval.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData(true);
        }
      }, 30000); 
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
        startPolling();
      } else if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, version, fetchData]);

  return { data, isLoading, error, refresh };
}
