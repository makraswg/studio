
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type DataSource = 'firestore' | 'mock' | 'mysql';

interface SettingsContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // 1. Initialisieren Sie den Zustand IMMER mit einem konsistenten Standardwert.
  //    Dies stellt sicher, dass Server und Client beim ersten Rendern dasselbe HTML erzeugen.
  const [dataSource, setDataSource] = useState<DataSource>('firestore');
  const [isHydrated, setIsHydrated] = useState(false);

  // 2. Dieser Effekt wird NUR auf dem Client ausgeführt, nachdem die Komponente gemountet wurde.
  useEffect(() => {
    const savedSource = localStorage.getItem('dataSource');
    if (savedSource === 'firestore' || savedSource === 'mock' || savedSource === 'mysql') {
      // Aktualisieren Sie den Zustand mit dem Wert aus dem Local Storage.
      setDataSource(savedSource);
    }
    // Markieren Sie die Komponente als "hydriert".
    setIsHydrated(true);
  }, []); // Die leere Abhängigkeitsliste stellt sicher, dass dies nur einmal passiert.

  // 3. Dieser Effekt speichert Änderungen zurück in den Local Storage.
  useEffect(() => {
    // Wir speichern erst, nachdem wir den initialen Wert geladen haben, 
    // um zu verhindern, dass der Standardwert einen gespeicherten Wert überschreibt.
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
