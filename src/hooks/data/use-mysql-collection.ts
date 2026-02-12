
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

// Globaler Cache zur Vermeidung von unnötigen Re-Renders
const mysqlCache: Record<string, { data: any[], timestamp: number, stringified: string }> = {};
const CACHE_TTL = 30000; 

/**
 * Optimierter MySQL Hook mit Inhalts-Validierung.
 * Verhindert das "Zucken" der UI, indem nur bei echten Datenänderungen aktualisiert wird.
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
        
        // Verhindere Re-Render wenn der Inhalt identisch ist
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

    fetchData();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true); 
      }
    }, 15000); 

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
