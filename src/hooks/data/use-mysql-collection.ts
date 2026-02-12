
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

// Global cache to prevent unnecessary re-renders across components
const mysqlCache: Record<string, { data: any[], timestamp: number, stringified: string }> = {};
const CACHE_TTL = 30000; 

/**
 * Optimized MySQL Hook with Deep Comparison.
 * Prevents UI flickering by only triggering state updates when data content actually changes.
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
  
  const isMounted = useRef(true);
  const prevDataString = useRef<string>(mysqlCache[collectionName]?.stringified || "");
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled || isFetchingRef.current || !isMounted.current) return;
    
    isFetchingRef.current = true;
    if (!silent && !prevDataString.current) {
      setIsLoading(true);
    }
    
    try {
      const result = await getCollectionData(collectionName);
      if (!isMounted.current) return;

      if (result.error) {
        setError(result.error);
        // Retry logic for transient failures
        if (!silent) {
          setTimeout(() => {
            if (isMounted.current) setVersion(v => v + 1);
          }, 2000);
        }
      } else {
        const newData = (result.data || []) as T[];
        const newDataString = JSON.stringify(newData);
        
        if (newDataString !== prevDataString.current) {
          setData(newData);
          prevDataString.current = newDataString;
          mysqlCache[collectionName] = { 
            data: newData, 
            timestamp: Date.now(),
            stringified: newDataString 
          };
        }
        setError(null);
      }
    } catch (e: any) {
      if (isMounted.current) setError(e.message || "Datenbankfehler");
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [collectionName, enabled]);

  const refresh = useCallback(() => {
    delete mysqlCache[collectionName];
    prevDataString.current = "";
    setVersion(v => v + 1);
  }, [collectionName]);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    fetchData();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true); 
      }
    }, 15000); 

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [enabled, version, fetchData]);

  return useMemo(() => ({ 
    data, 
    isLoading, 
    error, 
    refresh 
  }), [data, isLoading, error, refresh]);
}
