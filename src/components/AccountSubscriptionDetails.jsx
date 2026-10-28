import { useI18n } from '../i18n/I18nProvider.jsx';
import useAccountStatus from '../auth/useAccountStatus.js';
import AccountStatusBadge from './AccountStatusBadge.jsx';

export default function AccountSubscriptionDetails({ user }) {
  const { t, lang } = useI18n();
  const status = useAccountStatus(user.status, user.premiumExpiresAt);
  const expiry = new Date(user.premiumExpiresAt ?? '').getTime();
  const date = Number.isFinite(expiry) ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(expiry) : null;
  return <div className="profile-subscription">
    <div className="profile-account-status"><span>{t('account.statusLabel')}</span><strong>{t(`account.status.${status}`)}<AccountStatusBadge status={user.status} premiumExpiresAt={user.premiumExpiresAt} compact /></strong></div>
    {status === 'superadmin' ? <p className="profile-premium-term">{t('account.permanent')}</p> : date && (status === 'admin' || expiry <= Date.now()) && <p className="profile-premium-term">{t(status === 'admin' ? 'account.expiresAt' : 'account.expiredAt', { date })}</p>}
  </div>;
}
