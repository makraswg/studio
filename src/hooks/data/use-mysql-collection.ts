
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

// Global cache for MySQL data to avoid unnecessary re-fetches
const mysqlCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL = 10000; 

/**
 * A robust hook for fetching MySQL data with stability guarantees.
 */
export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(() => {
    const cached = mysqlCache[collectionName];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return cached.data as T[];
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(enabled && data === null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialFetch = useRef(true);
  const prevDataCount = useRef<number>(-1);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return;
    
    if (!silent && isInitialFetch.current) {
      setIsLoading(true);
    }
    
    try {
      const result = await getCollectionData(collectionName);
      if (result.error) {
        setError(result.error);
      } else {
        const newData = (result.data || []) as T[];
        
        if (newData.length !== prevDataCount.current || isInitialFetch.current) {
          setData(newData);
          prevDataCount.current = newData.length;
          mysqlCache[collectionName] = { data: newData, timestamp: Date.now() };
        }
        setError(null);
      }
    } catch (e: any) {
      setError(e.message || "Unbekannter Datenbankfehler");
    } finally {
      setIsLoading(false);
      isInitialFetch.current = false;
    }
  }, [collectionName, enabled]);

  const refresh = useCallback(() => {
    delete mysqlCache[collectionName];
    isInitialFetch.current = true;
    prevDataCount.current = -1;
    setVersion(v => v + 1);
  }, [collectionName]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      return;
    }

    fetchData();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true);
      }
    }, 60000); 

    pollingInterval.current = interval;
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [enabled, version, fetchData]);

  // Return a stable object to prevent infinite re-renders in consumer hooks
  return useMemo(() => ({ 
    data, 
    isLoading, 
    error, 
    refresh 
  }), [data, isLoading, error, refresh]);
}
