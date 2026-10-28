export default function AccountStatusBadge({ status, compact = false }) {
  if (status !== 'admin' && status !== 'superadmin') return null;
  const label = status === 'superadmin' ? 'Superadmin' : 'Premium';
  return <span className={`account-status-badge${compact ? ' account-status-badge--compact' : ''}`} title={label} aria-label={label}>
    <span aria-hidden="true">{status === 'superadmin' ? '♛' : '★'}</span>{!compact && label}
  </span>;
}
