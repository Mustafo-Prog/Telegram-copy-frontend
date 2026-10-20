import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, tError } = useI18n();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(form);
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">{t('auth.password')}</label>
          <input id="password" name="password" type="password" value={form.password} onChange={handleChange} autoComplete="current-password" required />
        </div>
        {error && <div className="auth-error" role="alert">{tError(error)}</div>}
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
      <div className="auth-card__footer">
        {t('auth.noAccount')} <Link to="/register">{t('auth.registerLink')}</Link>
      </div>
    </AuthLayout>
  );
}
