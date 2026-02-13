
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

const setSessionCookie = (user: PlatformUser | null) => {
  if (typeof document === 'undefined') return;
  if (user) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `auth_session=true; path=/; expires=${expires}; SameSite=Lax`;
  } else {
    document.cookie = "auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<PlatformUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore session on client-side only to prevent hydration mismatch
    const savedUser = localStorage.getItem('platform_session');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUserState(parsedUser);
        setSessionCookie(parsedUser);
      } catch (e) {
        localStorage.removeItem('platform_session');
        setSessionCookie(null);
      }
    }
    setIsUserLoading(false);
  }, []);

  const setUser = (newUser: PlatformUser | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('platform_session', JSON.stringify(newUser));
      setSessionCookie(newUser);
    } else {
      localStorage.removeItem('platform_session');
      setSessionCookie(null);
    }
  };

  const logout = () => {
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isUserLoading, logout }}>
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
