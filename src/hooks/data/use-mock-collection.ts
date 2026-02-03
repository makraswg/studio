
"use client";

import { useState, useEffect } from 'react';
import { getMockCollection } from '@/lib/mock-db';

/**
 * Ein Hook, um statische Mock-Daten zu laden.
 * @param collectionName Der Name der zu ladenden Sammlung.
 * @param enabled Gibt an, ob der Hook aktiv sein und Daten laden soll.
 */
export function useMockCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simuliert eine asynchrone Verzögerung, wie bei einem echten Netzwerk-Request
      setTimeout(() => {
        const collectionData = getMockCollection(collectionName) as T[];
        setData(collectionData);
        setIsLoading(false);
      }, 500); // 500ms Verzögerung

    } catch (err: any) {
      console.error("Mock data fetching error:", err);
      setError("Fehler beim Laden der Mock-Daten: " + err.message);
      setIsLoading(false);
    }
  }, [collectionName, enabled]);

  return { data, isLoading, error };
}
