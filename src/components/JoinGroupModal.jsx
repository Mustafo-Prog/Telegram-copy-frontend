import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { previewGroupInvite, joinGroupInvite } from '../api/groupsApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import ModalFrame from './ModalFrame.jsx';

export default function JoinGroupModal({ token, onClose, onJoined }) {
  const { t, tError } = useI18n();
  const { data: group, error, isPending } = useQuery({ queryKey: ['group-invite', token], queryFn: () => previewGroupInvite(token), retry: false });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  return <ModalFrame title={t('groups.invite')} onClose={onClose}>
    {isPending && <p>{t('common.loading')}</p>}
    {(error || joinError) && <p className="auth-error" role="alert">{tError(error || joinError)}</p>}
    {group && <div className="join-group"><h3>{group.title}</h3><p>{t('groups.memberCount', { count: group.memberCount })}</p><p className="field__hint">{t('groups.joinHint')}</p>
      <button className="btn-primary" disabled={joining} onClick={async () => { setJoining(true); setJoinError(null); try { await onJoined(await joinGroupInvite(token)); } catch (err) { setJoinError(err); setJoining(false); } }}>{joining ? t('common.loading') : t(group.alreadyMember ? 'groups.open' : 'groups.join')}</button>
    </div>}
  </ModalFrame>;
}
