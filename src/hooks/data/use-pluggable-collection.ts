
"use client";

import { usePluggableCollection as useBasePluggableCollection } from './use-pluggable-collection.tsx';

/**
 * Export-Proxy für Abwärtskompatibilität. 
 * Nutzt die zentralisierte und optimierte Implementierung.
 */
export function usePluggableCollection<T>(collectionName: string) {
  return useBasePluggableCollection<any>(collectionName);
}
