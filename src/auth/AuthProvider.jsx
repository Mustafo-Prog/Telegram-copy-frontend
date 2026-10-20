import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/authApi.js';
import { TOKEN_KEY } from '../api/http.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const restoreSession = useCallback(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSessionError(null);
    authApi
      .getMe()
      .then(setUser)
      .catch((err) => {
        if (err.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
        } else {
          setSessionError(err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const saveSession = useCallback(
    ({ token, user: sessionUser }) => {
      localStorage.setItem(TOKEN_KEY, token);
      queryClient.clear();
      setSessionError(null);
      setUser(sessionUser);
    },
    [queryClient]
  );

  const login = useCallback(
    async (credentials) => saveSession(await authApi.login(credentials)),
    [saveSession]
  );

  const register = useCallback(
    async (data) => saveSession(await authApi.register(data)),
    [saveSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
    setSessionError(null);
    setUser(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, sessionError, retrySession: restoreSession, login, register, logout }),
    [user, loading, sessionError, restoreSession, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
