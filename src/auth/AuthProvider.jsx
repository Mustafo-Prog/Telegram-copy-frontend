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

  const requestCode = useCallback((email) => authApi.requestCode(email), []);

  const verifyCode = useCallback(
    async ({ email, code }) => saveSession(await authApi.verifyCode(email, code)),
    [saveSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
    setSessionError(null);
    setUser(null);
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    const currentUser = await authApi.getMe();
    setUser((current) => current?.id === currentUser.id ? currentUser : current);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => { refreshUser().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id, refreshUser]);

  const value = useMemo(
    () => ({ user, loading, sessionError, retrySession: restoreSession, requestCode, verifyCode, logout, updateUser: setUser, refreshUser }),
    [user, loading, sessionError, restoreSession, requestCode, verifyCode, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
