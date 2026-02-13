
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { DataSource } from '@/lib/types';

interface SettingsContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // CRITICAL: Initialize with static defaults to prevent hydration mismatch in Next.js 15
  const [dataSource, setDataSourceState] = useState<DataSource>('mysql');
  const [activeTenantId, setActiveTenantIdState] = useState<string>('all');
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Only run on client after mount
    const savedSource = localStorage.getItem('dataSource');
    if (savedSource === 'firestore' || savedSource === 'mock' || savedSource === 'mysql') {
      setDataSourceState(savedSource as DataSource);
    }
    
    const savedTenant = localStorage.getItem('activeTenantId');
    if (savedTenant) {
      setActiveTenantIdState(savedTenant);
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme as 'light' | 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setThemeState('dark');
    }
    
    setIsHydrated(true);
  }, []);

  const setDataSource = (source: DataSource) => {
    setDataSourceState(source);
    localStorage.setItem('dataSource', source);
  };

  const setActiveTenantId = (id: string) => {
    setActiveTenantIdState(id);
    localStorage.setItem('activeTenantId', id);
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const value = { 
    dataSource, 
    setDataSource,
    activeTenantId,
    setActiveTenantId,
    theme,
    setTheme
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
