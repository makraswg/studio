
"use client";

import { useSettings } from '@/context/settings-context';
import { useFirestoreCollection } from './data/use-firestore-collection';
import { useMockCollection } from './data/use-mock-collection';
import { useMysqlCollection } from './data/use-mysql-collection';

/**
 * Ein übergeordneter Hook, der basierend auf den Anwendungseinstellungen dynamisch
 * den richtigen Daten-Hook (Firestore, Mock oder MySQL) auswählt und dessen Zustand zurückgibt.
 * @param collectionName Der Name der zu ladenden Sammlung.
 */
export function usePluggableCollection<T>(collectionName: string) {
  const { dataSource } = useSettings();

  // Jeder Hook wird mit der `enabled`-Flagge aufgerufen, die sicherstellt, 
  // dass nur der aktive Hook tatsächlich Daten lädt.
  const firestoreState = useFirestoreCollection<T>(collectionName, dataSource === 'firestore');
  const mockState = useMockCollection<T>(collectionName, dataSource === 'mock');
  const mysqlState = useMysqlCollection<T>(collectionName, dataSource === 'mysql');

  // Hier wird der entscheidende Fehler korrigiert:
  // Wir geben den Zustand des *spezifisch ausgewählten* Hooks zurück,
  // anstatt die Zustände zu kombinieren. Das verhindert, dass inaktive
  // Hooks den Ladezustand der gesamten Anwendung blockieren.
  switch (dataSource) {
    case 'firestore':
      return firestoreState;
    case 'mock':
      return mockState;
    case 'mysql':
      return mysqlState;
    default:
      // Fallback auf einen leeren Zustand, falls die Datenquelle ungültig ist.
      return { data: null, isLoading: false, error: `Ungültige Datenquelle: ${dataSource}` };
  }
}
