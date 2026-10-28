import { useI18n } from '../i18n/I18nProvider.jsx';

export default function AccountStatusBadge({ status, compact = false }) {
  const { t } = useI18n();
  if (status !== 'admin' && status !== 'superadmin') return null;
  const label = t(`account.status.${status}`);
  return <span className={`account-status-badge${compact ? ' account-status-badge--compact' : ''}`} title={label} aria-label={label}>
    <span aria-hidden="true">{status === 'superadmin' ? '♛' : '★'}</span>{!compact && label}
  </span>;
}
