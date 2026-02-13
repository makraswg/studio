
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

/**
 * Hilfsfunktion zum Setzen des Sitzungs-Cookies für die Middleware.
 */
const setSessionCookie = (user: PlatformUser | null) => {
  if (typeof document === 'undefined') return;
  if (user) {
    // Cookie für 24 Stunden setzen
    const date = new Date();
    date.setTime(date.getTime() + (24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    document.cookie = `auth_session=true${expires}; path=/; SameSite=Lax`;
  } else {
    // Cookie löschen
    document.cookie = "auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<PlatformUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    // Sitzung beim Laden aus LocalStorage wiederherstellen (nur Client-seitig)
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
    // Hard Redirect zur Login-Seite
    window.location.href = '/';
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
