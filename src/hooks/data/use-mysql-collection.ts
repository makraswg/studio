
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

// Global cache to prevent unnecessary re-renders
const mysqlCache: Record<string, { data: any[], timestamp: number, stringified: string }> = {};
const CACHE_TTL = 60000; // Increased to 1 minute

/**
 * Optimized MySQL Hook with deep content validation.
 * Prevents UI flickering by only triggering state updates when data actually changes.
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
  const prevDataString = useRef<string>(mysqlCache[collectionName]?.stringified || "");
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    if (!silent && !prevDataString.current) {
      setIsLoading(true);
    }
    
    try {
      const result = await getCollectionData(collectionName);
      if (result.error) {
        setError(result.error);
      } else {
        const newData = (result.data || []) as T[];
        const newDataString = JSON.stringify(newData);
        
        // ONLY update state if content is truly different
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
      setError(e.message || "Datenbankfehler");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [collectionName, enabled]);

  const refresh = useCallback(() => {
    delete mysqlCache[collectionName];
    prevDataString.current = "";
    setVersion(v => v + 1);
  }, [collectionName]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Polling with longer interval to reduce network noise
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true); 
      }
    }, 30000); 

    pollingInterval.current = interval;
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [enabled, version, fetchData]);

  return useMemo(() => ({ 
    data, 
    isLoading, 
    error, 
    refresh 
  }), [data, isLoading, error, refresh]);
}
