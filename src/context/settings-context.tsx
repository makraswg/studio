
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type DataSource = 'firestore' | 'mock' | 'mysql';

interface SettingsContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Der konsistente Startwert wird auf 'mysql' geändert.
  const [dataSource, setDataSource] = useState<DataSource>('mysql');
  const [isHydrated, setIsHydrated] = useState(false);

  // Dieser Effekt wird NUR auf dem Client ausgeführt, nachdem die Komponente gemountet wurde.
  useEffect(() => {
    // Wenn im Local Storage ein gespeicherter Wert existiert, wird dieser verwendet.
    const savedSource = localStorage.getItem('dataSource');
    if (savedSource === 'firestore' || savedSource === 'mock' || savedSource === 'mysql') {
      setDataSource(savedSource);
    }
    // Markiert die Komponente als "hydriert", um Hydration-Fehler zu vermeiden.
    setIsHydrated(true);
  }, []);

  // Dieser Effekt speichert zukünftige Änderungen zurück in den Local Storage.
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('dataSource', dataSource);
    }
  }, [dataSource, isHydrated]);

  const value = { dataSource, setDataSource };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
