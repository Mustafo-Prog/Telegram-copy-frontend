import { LANGUAGES, useI18n } from '../i18n/I18nProvider.jsx';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="lang-switch" role="group" aria-label={t('settings.language')}>
      {LANGUAGES.map((item) => (
        <button
          key={item.code}
          type="button"
          className="lang-switch__btn"
          aria-pressed={item.code === lang}
          title={item.name}
          onClick={() => setLang(item.code)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
