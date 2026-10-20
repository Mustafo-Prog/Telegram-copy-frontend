import { Navigate, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useAuth } from './AuthProvider.jsx';

function SessionState({ error, onRetry }) {
  const { t, tError } = useI18n();
  return (
    <div className="splash">
      <p>{t('auth.sessionCheckFailed', { reason: tError(error) })}</p>
      <button className="btn-primary" type="button" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}

function Loading() {
  const { t } = useI18n();
  return <div className="splash">{t('common.loading')}</div>;
}

export function ProtectedRoute() {
  const { user, loading, sessionError, retrySession } = useAuth();
  if (loading) return <Loading />;
  if (sessionError) return <SessionState error={sessionError} onRetry={retrySession} />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function GuestRoute() {
  const { user, loading, sessionError, retrySession } = useAuth();
  if (loading) return <Loading />;
  if (sessionError) return <SessionState error={sessionError} onRetry={retrySession} />;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
