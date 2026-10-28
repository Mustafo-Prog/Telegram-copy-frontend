import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfileById, promoteUser, removeAvatar, updatePrivacy, updateProfile, uploadAvatar } from '../api/usersApi.js';
import PresenceLabel from './PresenceLabel.jsx';
import Avatar from './Avatar.jsx';
import AvatarViewer from './AvatarViewer.jsx';
import { resizeAvatar } from '../utils/avatar.js';
import { setPresenceMany } from '../realtime/presence.js';
import { watchPresence, unwatchPresence } from '../realtime/socket.js';
import AccountStatusBadge from './AccountStatusBadge.jsx';
import { canPromoteUser, effectiveAccountStatus, mergeAccountProfile, updateAccountCaches } from '../utils/accountStatus.js';
import useAccountStatus from '../auth/useAccountStatus.js';
import AccountSubscriptionDetails from './AccountSubscriptionDetails.jsx';

const USERNAME_PATTERN = '[a-z0-9_]{3,32}';

// Своё окно профиля (редактирование) или чужой профиль (только просмотр)
export default function ProfileModal({ profile, readOnly = false, onClose, onMessage }) {
  const { user, updateUser } = useAuth();
  const { t, tError } = useI18n();
  const queryClient = useQueryClient();
  // Fetch by ID so Promote also works when the user has never chosen a username.
  const { data: fullProfile } = useQuery({
    queryKey: ['profile', profile?.id],
    queryFn: () => getProfileById(profile.id),
    enabled: readOnly && Boolean(profile?.id),
    structuralSharing: mergeAccountProfile,
  });
  const data = readOnly ? { ...profile, ...(fullProfile ?? {}) } : user;
  const resolvedStatus = useAccountStatus(data.status, data.premiumExpiresAt);
  useEffect(() => {
    if (!readOnly || !data.id) return undefined;
    watchPresence([data.id], setPresenceMany);
    return () => unwatchPresence([data.id]);
  }, [readOnly, data.id]);
  const fileRef = useRef(null);

  const [displayName, setDisplayName] = useState(data.displayName ?? '');
  const [username, setUsername] = useState(data.username ?? '');
  const [bio, setBio] = useState(data.bio ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [durationDays, setDurationDays] = useState(30);
  const promotingRef = useRef(false);
  const viewingAvatar = avatarOpen && Boolean(data.avatarUrl);
  const closeAvatar = useCallback(() => setAvatarOpen(false), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || viewingAvatar) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, viewingAvatar]);

  const run = async (action) => {
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const result = await action();
      updateUser(result);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const messageUser = async () => {
    setError(null);
    setPending(true);
    try {
      await onMessage(data);
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };

  const promote = async () => {
    if (!canPromoteUser(user, data) || promotingRef.current) return;
    promotingRef.current = true;
    setPending(true); setError(null);
    try {
      const renew = effectiveAccountStatus(data) === 'admin';
      const result = await promoteUser(data.id, { durationDays, renew,
        ...(renew ? { expectedExpiresAt: data.premiumExpiresAt, expectedVersion: data.premiumVersion ?? 0 } : {}),
      });
      queryClient.setQueryData(['profile', data.id], (current) => mergeAccountProfile({ ...data, ...current }, result));
      updateAccountCaches(queryClient, { userId: result.id, status: result.status, premiumExpiresAt: result.premiumExpiresAt, premiumVersion: result.premiumVersion });
      setPromoted(true);
    } catch (err) {
      setError(err);
      if (err.code === 'premium_changed') queryClient.invalidateQueries({ queryKey: ['profile', data.id] });
    }
    finally { promotingRef.current = false; setPending(false); }
  };

  const save = (e) => {
    e.preventDefault();
    const payload = { displayName: displayName.trim(), bio: bio.trim() };
    if (username.trim()) payload.username = username.trim().replace(/^@/, '').toLowerCase();
    run(() => updateProfile(payload));
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) run(async () => uploadAvatar(await resizeAvatar(file)));
  };

  return (
    <>
    <div className="modal-overlay" aria-hidden={viewingAvatar ? 'true' : undefined} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t('profile.title')}>
        <header className="modal__header">
          <h2>{t('profile.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('profile.close')}>
            ×
          </button>
        </header>

        <div className="modal__avatar">
          {data.avatarUrl ? <button type="button" className="profile-avatar-trigger" onClick={() => setAvatarOpen(true)} aria-label={t('avatarViewer.open')} title={t('avatarViewer.open')}>
            <Avatar name={data.displayName} seed={data.id} size={96} src={data.avatarUrl} />
          </button> : <Avatar name={data.displayName} seed={data.id} size={96} />}
          {!readOnly && (
            <div className="modal__avatar-actions">
              <button type="button" className="btn-link" disabled={pending} onClick={() => fileRef.current?.click()}>
                {t('profile.changePhoto')}
              </button>
              {data.avatarUrl && (
                <button type="button" className="btn-link" disabled={pending} onClick={() => run(removeAvatar)}>
                  {t('profile.removePhoto')}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={pickFile}
              />
            </div>
          )}
        </div>

        {readOnly ? (
          <div className="modal__info">
            <div className="modal__name">{data.displayName}<AccountStatusBadge status={data.status} premiumExpiresAt={data.premiumExpiresAt} compact /></div>
            <div className="modal__username">{data.username ? `@${data.username}` : t('profile.noUsername')}</div>
            {data.id && (
              <div className="modal__presence">
                <PresenceLabel userId={data.id} fallback={data.presence} lastSeenAt={data.lastSeenAt} />
              </div>
            )}
            <p className="modal__bio">{data.bio || t('profile.noBio')}</p>
          </div>
        ) : (
          <form onSubmit={save}>
            <AccountSubscriptionDetails user={data} />
            <div className="field">
              <label htmlFor="profile-name">{t('profile.displayName')}</label>
              <input
                id="profile-name"
                value={displayName}
                maxLength={50}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="profile-username">{t('profile.username')}</label>
              <div className="input-prefix">
                <span>@</span>
                <input
                  id="profile-username"
                  value={username}
                  pattern={USERNAME_PATTERN}
                  maxLength={32}
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value.replace(/^@/, '').toLowerCase())}
                />
              </div>
              <small className="field__hint">{t('profile.usernameHint')}</small>
            </div>
            <div className="field">
              <label htmlFor="profile-bio">{t('profile.bio')}</label>
              <textarea
                id="profile-bio"
                rows={3}
                maxLength={150}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            {error && <div className="auth-error" role="alert">{tError(error)}</div>}
            {saved && !error && <div className="form-ok" role="status">{t('profile.saved')}</div>}
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? t('profile.saving') : t('profile.save')}
            </button>
          </form>
        )}

        {!readOnly && (
          <section className="privacy" aria-labelledby="privacy-title">
            <h3 id="privacy-title" className="privacy__title">{t('privacy.title')}</h3>
            <div className="privacy__group">{t('privacy.onlineStatus')}</div>
            <label className="toggle-row">
              <span>{t('privacy.showOnline')}</span>
              <input
                type="checkbox"
                checked={user.privacy?.showOnlineStatus !== false}
                disabled={pending}
                onChange={() => run(() => updatePrivacy(user.privacy?.showOnlineStatus === false))}
              />
            </label>
            <p className="field__hint">{t('privacy.showOnlineHint')}</p>
          </section>
        )}
        {readOnly && onMessage && data.id && data.id !== user.id && (
          <button className="btn-primary modal__message" type="button" disabled={pending} onClick={messageUser}>
            {t('profile.sendMessage')}
          </button>
        )}
        {readOnly && error && <div className="auth-error" role="alert">{tError(error)}</div>}
        {readOnly && <AccountSubscriptionDetails user={data} />}
        {readOnly && canPromoteUser(user, data) && <section className="profile-premium-grant">
          <label htmlFor="premium-duration">{t('account.duration')}</label>
          <select id="premium-duration" value={durationDays} disabled={pending} onChange={(event) => setDurationDays(Number(event.target.value))}>
            {[7, 30, 90, 365].map((days) => <option key={days} value={days}>{t('account.days', { count: days })}</option>)}
          </select>
          <button type="button" className="btn-ghost btn-block profile-promote" disabled={pending} onClick={promote}>
            <span aria-hidden="true">★ </span>{pending ? t('account.promoting') : t(resolvedStatus === 'admin' ? 'account.renew' : 'account.promote')}
            <small>{t(resolvedStatus === 'admin' ? 'account.renewHint' : 'account.promoteHint')}</small>
          </button>
        </section>}
        {readOnly && promoted && !error && <p className="form-ok" role="status">{t('account.promoted')}</p>}
      </div>
    </div>
    {viewingAvatar && <AvatarViewer src={data.avatarUrl} name={data.displayName} onClose={closeAvatar} />}
    </>
  );
}
