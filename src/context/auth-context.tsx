
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
 * Helper to manage session cookies for server-side protection (Middleware).
 */
const setSessionCookie = (user: PlatformUser | null) => {
  if (typeof document === 'undefined') return;
  if (user) {
    // Set a session cookie that expires when the browser is closed (or after 24h)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `auth_session=true; path=/; expires=${expires}; SameSite=Lax`;
  } else {
    // Remove the cookie
    document.cookie = "auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore session from localStorage on mount
    const restoreSession = () => {
      const savedUser = localStorage.getItem('platform_session');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setSessionCookie(parsedUser);
        } catch (e) {
          console.error("Auth: Session restoration failed", e);
          localStorage.removeItem('platform_session');
          setSessionCookie(null);
        }
      }
      setIsUserLoading(false);
    };

    restoreSession();
  }, []);

  const handleSetUser = (newUser: PlatformUser | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('platform_session', JSON.stringify(newUser));
      setSessionCookie(newUser);
    } else {
      localStorage.removeItem('platform_session');
      setSessionCookie(null);
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
