
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { DataSource } from '@/lib/types';

interface SettingsContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dataSource, setDataSource] = useState<DataSource>('mysql');
  const [activeTenantId, setActiveTenantId] = useState<string>('all');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedSource = typeof window !== 'undefined' ? localStorage.getItem('dataSource') : null;
    if (savedSource === 'firestore' || savedSource === 'mock' || savedSource === 'mysql') {
      setDataSource(savedSource as DataSource);
    }
    
    const savedTenant = typeof window !== 'undefined' ? localStorage.getItem('activeTenantId') : null;
    if (savedTenant) {
      setActiveTenantId(savedTenant);
    }
    
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
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
