import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchUsers } from '../api/usersApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import Avatar from './Avatar.jsx';
import AccountStatusBadge from './AccountStatusBadge.jsx';

const MIN_QUERY = 2;

export default function UserSearch({ onSelect, excludeIds = [] }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const query = input.trim().replace(/^@/, '').toLowerCase();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => searchUsers(query),
    enabled: query.length >= MIN_QUERY,
  });
  const users = results.filter((user) => !excludeIds.includes(user.id));

  return (
    <div className="user-search">
      <input
        type="search"
        className="user-search__input"
        value={input}
        placeholder={t('search.placeholder')}
        onChange={(e) => setInput(e.target.value)}
        aria-label={t('search.placeholder')}
        autoComplete="off"
      />
      {query.length >= MIN_QUERY && (
        <ul className="user-search__results">
          {!isFetching && users.length === 0 && <li className="user-search__hint">{t('search.empty')}</li>}
          {users.map((u) => (
            <li key={u.id}>
              <button type="button" className="user-search__item" onClick={() => onSelect(u)}>
                <Avatar name={u.displayName} seed={u.id} size={34} src={u.avatarUrl} />
                <span className="user-search__text">
                  <span className="user-search__name">{u.displayName}<AccountStatusBadge status={u.status} compact /></span>
                  <span className="user-search__username">@{u.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length > 0 && query.length < MIN_QUERY && <div className="user-search__hint">{t('search.hint')}</div>}
    </div>
  );
}
