import { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, AuthUser } from '@/hooks/useAuth';
import { AUTH_TOKEN_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_USER_KEY, ROUTES } from '@/config/constants';
import { setOnUnauthorized } from '@/services/api-client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from sessionStorage on mount (per-tab session)
  useEffect(() => {
    const storedUser = sessionStorage.getItem(AUTH_USER_KEY);
    const storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        sessionStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // Wire the 401 interceptor to logout + redirect
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
      navigate(ROUTES.LOGIN, { replace: true });
    });
    return () => setOnUnauthorized(null);
  }, [navigate]);

  const login = useCallback((token: string, authUser: AuthUser, refreshToken?: string) => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    if (refreshToken) {
      sessionStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
    }
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
