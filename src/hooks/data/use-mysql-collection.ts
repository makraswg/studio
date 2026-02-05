
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';

/**
 * Ein optimierter Hook, um Daten aus einer MySQL-Datenbank zu laden.
 * Implementiert intelligentes Polling, das nur bei aktivem Tab läuft.
 */
export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (!silent) setIsLoading(true);
    
    try {
      const result = await getCollectionData(collectionName);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data as T[]);
        setError(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [collectionName, enabled]);

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

    // Initialer Abruf
    fetchData();

    // Polling-Logik mit Sichtbarkeitsprüfung
    const startPolling = () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      // Erhöhtes Intervall (30s) für bessere Performance
      pollingInterval.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData(true);
        }
      }, 30000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true); // Sofortiger Refresh beim Zurückkehren
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
