import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

const DEFAULT_COOLDOWN = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { requestCode, verifyCode } = useAuth();
  const { t, tError } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  // Обратный отсчёт до повторной отправки кода
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setError(null);
    // Проверяем адрес до запроса, чтобы не тратить попытки на заведомо неверные данные
    if (!EMAIL_RE.test(email.trim())) {
      setError({ code: 'invalid_email' });
      return;
    }
    setPending(true);
    try {
      const data = await requestCode(email);
      setStep('code');
      setCooldown(data.cooldown ?? DEFAULT_COOLDOWN);
    } catch (err) {
      // Код уже был отправлен недавно: переходим к вводу, показываем сколько ждать
      if (err.code === 'code_cooldown') {
        setStep('code');
        setCooldown(err.params?.seconds ?? DEFAULT_COOLDOWN);
      }
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await verifyCode({ email, code });
    } catch (err) {
      setError(err);
      setCode('');
      setPending(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setCooldown(0);
  };

  if (step === 'email') {
    return (
      <AuthLayout title={t('auth.welcome')} subtitle={t('auth.loginSubtitle')}>
        <form onSubmit={sendCode}>
          <div className="field">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          {error && <div className="auth-error" role="alert">{tError(error)}</div>}
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? t('auth.sendingCode') : t('auth.continue')}
          </button>
          <p className="auth-hint">{t('auth.emailHint')}</p>
        </form>
        <button type="button" className="btn-ghost btn-block" onClick={() => navigate('/demo')}>
          {t('demo.open')}
        </button>
        <p className="demo-note">{t('demo.note')}</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.checkEmail')} subtitle={t('auth.codeSubtitle', { email })}>
      <form onSubmit={submitCode}>
        <div className="field">
          <label htmlFor="code">{t('auth.codeLabel')}</label>
          <input
            id="code"
            name="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
            required
          />
        </div>
        {error && <div className="auth-error" role="alert">{tError(error)}</div>}
        <button className="btn-primary" type="submit" disabled={pending || code.length !== 6}>
          {pending ? t('auth.verifying') : t('auth.verify')}
        </button>
      </form>
      <div className="auth-actions">
        <button
          type="button"
          className="btn-link"
          disabled={cooldown > 0 || pending}
          onClick={sendCode}
        >
          {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
        </button>
        <button type="button" className="btn-link" onClick={changeEmail}>
          {t('auth.changeEmail')}
        </button>
      </div>
    </AuthLayout>
  );
}
