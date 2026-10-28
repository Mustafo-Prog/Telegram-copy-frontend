import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nProvider.jsx';
import ModalFrame from './ModalFrame.jsx';
import Avatar from './Avatar.jsx';
import AccountStatusBadge from './AccountStatusBadge.jsx';

export default function MessageReadersModal({ chat, messageId, onClose }) {
  const { t, tError } = useI18n();
  const { data: readers = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['message-readers', chat.key, messageId], queryFn: () => chat.readers(messageId), refetchInterval: 5000,
  });
  return <ModalFrame title={t('readers.title')} onClose={onClose}>
    {isLoading ? <p role="status">{t('common.loading')}</p> : isError ? <div role="alert"><p>{tError(error)}</p><button type="button" className="btn-link" onClick={() => refetch()}>{t('chat.retry')}</button></div> : <>
      <p className="message-readers__summary" role="status">{readers.length ? t('readers.count', { count: readers.length }) : t('readers.empty')}</p>
      <ul className="message-readers">{readers.map((user) => <li key={user.id}>
        <Avatar name={user.displayName} seed={user.id} src={user.avatarUrl} size={42} />
        <span><strong>{user.displayName}<AccountStatusBadge status={user.status} premiumExpiresAt={user.premiumExpiresAt} compact /></strong>{user.username && <small>@{user.username}</small>}</span>
        <span className="message-readers__check" aria-hidden="true">✓✓</span>
      </li>)}</ul>
    </>}
  </ModalFrame>;
}
