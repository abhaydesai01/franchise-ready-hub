import { useEffect, useState, useCallback } from 'react';

interface AuthUser {
  _id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'franchise-ready-auth';

function getStoredAuth():
  | { user: AuthUser; accessToken: string; refreshToken: string }
  | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    };
  } catch {
    return null;
  }
}

export function setAuth(response: LoginResponse) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    }),
  );
}

export function clearAuth() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getStoredAuth()?.accessToken ?? null;
}

export function useAuth() {
  // Read storage synchronously on first render so ProtectedRoute does not redirect
  // to /login before useEffect runs (would happen right after successful login).
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuth()?.user ?? null);

  useEffect(() => {
    const sync = () => setUser(getStoredAuth()?.user ?? null);
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    setUser,
    logout,
  };
}

