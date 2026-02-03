
"use client";

import { useState, useEffect } from 'react';
import { getCollectionData } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';

/**
 * Ein Hook, um Daten aus einer MySQL-Datenbank über eine sichere Server-Aktion zu laden.
 * @param collectionName Der Name der zu ladenden Sammlung (z.B. 'users').
 * @param enabled Gibt an, ob der Hook aktiv sein und Daten laden soll.
 */
export function useMysqlCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(null);
  // Der Ladezustand ist nur dann initial `true`, wenn der Hook auch aktiviert ist.
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wenn der Hook nicht aktiviert ist, wird die Funktion sofort verlassen.
    // Alle Zustände werden zurückgesetzt.
    if (!enabled) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      const result = await getCollectionData(collectionName);

      if (result.error) {
        console.error("MySQL data fetching error:", result.error);
        setError(result.error);
        toast({
          variant: "destructive",
          title: "MySQL-Datenbankfehler",
          description: result.error,
        });
        setData(null);
      } else {
        setData(result.data as T[]);
      }
      
      setIsLoading(false);
    };

    fetchData();

  // Die Abhängigkeit von `enabled` stellt sicher, dass der Hook bei Änderungen neu ausgeführt wird.
  }, [collectionName, enabled]);

  return { data, isLoading, error };
}
