import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function MessageSearchPanel({ chat, onClose, onJump }) {
  const { t, tError, formatDay, formatTime } = useI18n();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [jumping, setJumping] = useState(null);
  useEffect(() => { const timer = setTimeout(() => setQuery(input.trim()), 250); return () => clearTimeout(timer); }, [input]);
  const search = useInfiniteQuery({
    queryKey: ['message-search', chat.key, query],
    queryFn: ({ pageParam }) => chat.search(query, pageParam),
    enabled: query.length >= 2 && query.length <= 100,
    initialPageParam: undefined,
    getNextPageParam: (page) => page.hasMore ? page.messages.at(-1)?.id : undefined,
  });
  const messages = search.data?.pages.flatMap((page) => page.messages) ?? [];
  return <section className="message-search" aria-label={t('messageSearch.title')}>
    <div className="message-search__bar"><input type="search" autoFocus value={input} maxLength={100} placeholder={t('messageSearch.placeholder')} aria-label={t('messageSearch.title')} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }} /><button type="button" className="icon-btn" onClick={onClose} aria-label={t('profile.close')}>×</button></div>
    {query.length < 2 && <p className="field__hint">{t('messageSearch.hint')}</p>}
    {search.isFetching && <p className="field__hint">{t('common.loading')}</p>}
    {search.isError && <p className="auth-error" role="alert">{tError(search.error)}</p>}
    {query.length >= 2 && !search.isFetching && !search.isError && !messages.length && <p className="field__hint">{t('messageSearch.empty')}</p>}
    {Boolean(messages.length) && <div className="message-search__results">{messages.map((message) => <button key={message.id} type="button" disabled={Boolean(jumping)} onClick={async () => { setJumping(message.id); try { await onJump(message.id); } finally { setJumping(null); } }}>
      <span><strong>{message.senderName ?? t('chat.deletedUser')}</strong><small>{formatDay(message.createdAt)} · {formatTime(message.createdAt)}</small></span>
      <p>{jumping === message.id ? t('messageSearch.jumping') : message.text || message.attachment?.name || t('chat.file')}</p>
    </button>)}</div>}
    {search.hasNextPage && <button type="button" className="btn-link" disabled={search.isFetchingNextPage} onClick={() => search.fetchNextPage()}>{t('messageSearch.more')}</button>}
  </section>;
}
