
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { PlatformUser } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: PlatformUser | null;
  setUser: (user: PlatformUser | null) => void;
  isUserLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore session from localStorage on mount
    const savedUser = localStorage.getItem('platform_session');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('platform_session');
      }
    }
    setIsUserLoading(false);
  }, []);

  const handleSetUser = (newUser: PlatformUser | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('platform_session', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('platform_session');
    }
  };

  const logout = () => {
    handleSetUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser, isUserLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('usePlatformAuth must be used within an AuthProvider');
  }
  return context;
}
