
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type DataSource = 'firestore' | 'mock' | 'mysql';
// We change TenantId to string to allow dynamic IDs from the database
export type TenantId = string; 

interface SettingsContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  activeTenantId: TenantId;
  setActiveTenantId: (id: TenantId) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dataSource, setDataSource] = useState<DataSource>('firestore');
  const [activeTenantId, setActiveTenantId] = useState<TenantId>('all');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedSource = localStorage.getItem('dataSource');
    if (savedSource === 'firestore' || savedSource === 'mock' || savedSource === 'mysql') {
      setDataSource(savedSource as DataSource);
    }
    const savedTenant = localStorage.getItem('activeTenantId');
    if (savedTenant) {
      setActiveTenantId(savedTenant);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('dataSource', dataSource);
      localStorage.setItem('activeTenantId', activeTenantId);
    }
  }, [dataSource, activeTenantId, isHydrated]);

  const value = { 
    dataSource, 
    setDataSource, 
    activeTenantId, 
    setActiveTenantId 
  };

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
