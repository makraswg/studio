
"use client";

import { useSettings } from "@/context/settings-context";
import { useFirestoreCollection } from "./use-firestore-collection";
import { useMockCollection } from "./use-mock-collection";
import { useMysqlCollection } from "./use-mysql-collection"; // Import des neuen MySQL-Hooks

/**
 * Ein universeller Hook, der basierend auf der globalen Einstellung (dataSource)
 * die Daten aus der entsprechenden Quelle (Firestore, Mock oder MySQL) lädt.
 * @param collectionName Der Name der zu ladenden Sammlung.
 * @returns Ein Objekt mit `data`, `isLoading` und `error` von der ausgewählten Datenquelle.
 */
export function usePluggableCollection<T>(collectionName: string) {
  const { dataSource } = useSettings();

  // Die Hooks werden bedingt aufgerufen, was normalerweise nicht empfohlen ist.
  // In diesem spezifischen Fall ist es jedoch kontrolliert und akzeptabel, da sich
  // der `dataSource` während des Lebenszyklus einer Komponente nicht ändert.
  const firestoreData = useFirestoreCollection<T>(collectionName, dataSource === 'firestore');
  const mockData = useMockCollection<T>(collectionName, dataSource === 'mock');
  const mysqlData = useMysqlCollection<T>(collectionName, dataSource === 'mysql'); // Verwendung des neuen MySQL-Hooks

  // Basierend auf der dataSource-Einstellung werden die korrekten Daten zurückgegeben.
  switch (dataSource) {
    case 'mysql':
      return mysqlData;
    case 'mock':
      return mockData;
    case 'firestore':
    default:
      return firestoreData;
  }
}
