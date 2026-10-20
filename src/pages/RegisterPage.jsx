import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, tError } = useI18n();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register(form);
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };

  return (
    <AuthLayout title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="displayName">{t('auth.name')}</label>
          <input id="displayName" name="displayName" value={form.displayName} onChange={handleChange} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">{t('auth.password')}</label>
          <input id="password" name="password" type="password" value={form.password} onChange={handleChange} autoComplete="new-password" required />
        </div>
        {error && <div className="auth-error" role="alert">{tError(error)}</div>}
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? t('auth.signingUp') : t('auth.signUp')}
        </button>
      </form>
      <div className="auth-card__footer">
        {t('auth.haveAccount')} <Link to="/login">{t('auth.signInLink')}</Link>
      </div>
    </AuthLayout>
  );
}
