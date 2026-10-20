import LanguageSwitcher from './LanguageSwitcher.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { SendIcon } from './icons.jsx';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-page__tools">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="auth-card__mark">
          <SendIcon width={26} height={26} />
        </div>
        <h1>{title}</h1>
        <p className="auth-card__sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
