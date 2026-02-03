
"use client";

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

/**
 * Ein Hook, um Daten aus einer Firestore-Sammlung zu laden.
 * @param collectionName Der Name der zu ladenden Sammlung.
 * @param enabled Gibt an, ob der Hook aktiv sein und Daten laden soll.
 */
export function useFirestoreCollection<T>(collectionName: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const db = useFirestore();

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    if (!db) {
      setError("Firestore ist nicht initialisiert. Überprüfen Sie Ihre Firebase-Konfiguration.");
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const collectionData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as T[];
        setData(collectionData);
      } catch (error: any) {
        console.error("Firestore data fetching error:", error);
        let errorMessage = 'Ein unbekannter Fehler ist aufgetreten.';
        if (error.code === 'permission-denied') {
          errorMessage = 'Berechtigung verweigert. Überprüfen Sie Ihre Firestore-Sicherheitsregeln.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Der Dienst ist nicht verfügbar. Prüfen Sie die Netzwerkverbindung und den Firebase-Status.';
        }
        setError(errorMessage);
        toast({
            variant: "destructive",
            title: "Firestore-Fehler",
            description: errorMessage
        })
      }
      setIsLoading(false);
    };

    fetchData();
  }, [collectionName, db, enabled]);

  return { data, isLoading, error };
}
