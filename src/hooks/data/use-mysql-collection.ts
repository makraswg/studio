
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

// Global cache to persist data across hook instances and prevent flickering
const mysqlCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL = 10000; 

/**
 * Enhanced MySQL data hook with deep stability.
 * Prevents UI flickering by ensuring reference stability and silent background updates.
 */
export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  // Use cached data as initial state to avoid empty state on fast navigation
  const [data, setData] = useState<T[] | null>(() => {
    const cached = mysqlCache[collectionName];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return cached.data as T[];
    }
    return null;
  });
  
  // Only show loading if we don't have any data yet
  const [isLoading, setIsLoading] = useState(enabled && data === null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const prevDataString = useRef<string>(data ? JSON.stringify(data) : "");

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return;
    
    if (!silent && !data) {
      setIsLoading(true);
    }
    
    try {
      const result = await getCollectionData(collectionName);
      if (result.error) {
        setError(result.error);
      } else {
        const newData = (result.data || []) as T[];
        const newDataString = JSON.stringify(newData);
        
        // CRITICAL: Only update state if content is truly different
        // This prevents the "flickering" (re-renders triggered by reference changes)
        if (newDataString !== prevDataString.current) {
          setData(newData);
          prevDataString.current = newDataString;
          mysqlCache[collectionName] = { data: newData, timestamp: Date.now() };
        }
        setError(null);
      }
    } catch (e: any) {
      setError(e.message || "Datenbankfehler");
    } finally {
      setIsLoading(false);
    }
  }, [collectionName, enabled, data]);

  const refresh = useCallback(() => {
    delete mysqlCache[collectionName];
    prevDataString.current = "";
    setVersion(v => v + 1);
  }, [collectionName]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      return;
    }

    fetchData();

    // Polling for updates (silent background refresh)
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
