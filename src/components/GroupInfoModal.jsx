import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/groupsApi.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import Avatar from './Avatar.jsx';
import PresenceLabel from './PresenceLabel.jsx';
import ModalFrame from './ModalFrame.jsx';
import MemberPicker from './MemberPicker.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import AccountStatusBadge from './AccountStatusBadge.jsx';

export default function GroupInfoModal({ groupId, onClose, onUpdated, onRemoved }) {
  const { user } = useAuth();
  const { t, tError } = useI18n();
  const client = useQueryClient();
  const { data: group, isPending, error: loadError, refetch } = useQuery({ queryKey: ['group', groupId], queryFn: () => api.getGroup(groupId) });
  const [name, setName] = useState(null);
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [invite, setInvite] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const owner = group?.ownerId === user.id;
  const admin = owner || group?.adminIds.includes(user.id);

  const run = async (action, removed = false) => {
    if (pending) return;
    setPending(true); setError(null);
    try {
      const result = await action();
      if (removed) { onRemoved(); return; }
      if (result?.conversation) onUpdated(result.conversation);
      await Promise.all([client.invalidateQueries({ queryKey: ['group', groupId] }), client.invalidateQueries({ queryKey: ['conversations'] })]);
      setMembers([]);
    } catch (err) { setError(tError(err)); }
    finally { setPending(false); }
  };

  return <>
    <ModalFrame title={t('groups.info')} onClose={onClose} wide>
      {isPending && <p>{t('common.loading')}</p>}
      {loadError && <div className="auth-error" role="alert">{tError(loadError)} <button className="btn-link" onClick={() => refetch()}>{t('chat.retry')}</button></div>}
      {group && <>
        <div className="group-summary"><Avatar name={group.title} seed={group.id} size={64} /><div><h3>{group.title}</h3><p>{t('groups.memberCount', { count: group.members.length })}</p></div></div>
        {admin && <form className="group-rename" onSubmit={(event) => { event.preventDefault(); run(() => api.renameGroup(groupId, name ?? group.title)); }}>
          <input aria-label={t('groups.name')} maxLength={80} required value={name ?? group.title} onChange={(event) => setName(event.target.value)} disabled={pending} />
          <button className="btn-ghost" disabled={pending || !(name ?? group.title).trim()}>{t('profile.save')}</button>
        </form>}
        <h3 className="feature-section-title">{t('groups.members')}</h3>
        <ul className="group-members">{group.members.map((member) => {
          const memberOwner = member.id === group.ownerId;
          const memberAdmin = group.adminIds.includes(member.id);
          return <li key={member.id}>
            <Avatar name={member.displayName} seed={member.id} src={member.avatarUrl} size={36} />
            <div className="group-member__body"><strong>{member.displayName}<AccountStatusBadge status={member.status} premiumExpiresAt={member.premiumExpiresAt} compact /></strong><small>{memberOwner ? t('groups.owner') : memberAdmin ? t('groups.admin') : member.username ? `@${member.username}` : t('groups.member')}</small><PresenceLabel userId={member.id} fallback={member.presence} lastSeenAt={member.lastSeenAt} /></div>
            <div className="group-member__actions">
              {owner && !memberOwner && <>
                <button className="btn-link" disabled={pending} onClick={() => run(() => api.setGroupAdmin(groupId, member.id, !memberAdmin))}>{t(memberAdmin ? 'groups.demote' : 'groups.promote')}</button>
                <button className="btn-link" disabled={pending} onClick={() => setConfirm({ title: t('groups.transfer'), text: t('groups.transferConfirm', { name: member.displayName }), action: () => api.transferGroupOwner(groupId, member.id) })}>{t('groups.transfer')}</button>
              </>}
              {admin && !memberOwner && member.id !== user.id && (owner || !memberAdmin) && <button className="btn-link danger-text" disabled={pending} onClick={() => setConfirm({ title: t('groups.removeMember'), text: member.displayName, action: () => api.removeGroupMember(groupId, member.id) })}>{t('groups.removeMember')}</button>}
            </div>
          </li>;
        })}</ul>
        {admin && <section className="group-add">
          <h3 className="feature-section-title">{t('groups.addMembers')}</h3>
          <MemberPicker selected={members} onChange={setMembers} excludeIds={group.members.map((member) => member.id)} disabled={pending} />
          <button className="btn-ghost btn-block" disabled={pending || !members.length} onClick={() => run(() => api.addGroupMembers(groupId, members.map((member) => member.id)))}>{t('groups.addMembers')}</button>
          <h3 className="feature-section-title">{t('groups.invite')}</h3>
          <p className="field__hint">{t('groups.inviteHint')}</p>
          <button className="btn-ghost btn-block" disabled={pending} onClick={() => run(async () => { const token = await api.createGroupInvite(groupId); setInvite(`${window.location.origin}/?join=${token}`); setCopied(false); })}>{t('groups.createInvite')}</button>
          {invite && <div className="group-invite"><input readOnly value={invite} aria-label={t('groups.invite')} onFocus={(event) => event.target.select()} /><button className="btn-link" onClick={async () => { try { await navigator.clipboard.writeText(invite); setCopied(true); } catch { setError(t('groups.copyHint')); } }}>{t(copied ? 'actions.copied' : 'actions.copy')}</button></div>}
        </section>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="group-footer">
          {owner ? <><p className="field__hint">{t('groups.ownerLeaveHint')}</p><button className="btn-danger btn-block" disabled={pending} onClick={() => setConfirm({ title: t('groups.delete'), text: t('groups.deleteConfirm'), action: () => api.deleteGroup(groupId), removed: true })}>{t('groups.delete')}</button></> :
            <button className="btn-danger btn-block" disabled={pending} onClick={() => setConfirm({ title: t('groups.leave'), text: t('groups.leaveConfirm'), action: () => api.leaveGroup(groupId), removed: true })}>{t('groups.leave')}</button>}
        </div>
      </>}
    </ModalFrame>
    {confirm && <ConfirmDialog title={confirm.title} text={confirm.text} confirmLabel={t('groups.confirm')} danger onCancel={() => setConfirm(null)} onConfirm={() => { const current = confirm; setConfirm(null); run(current.action, current.removed); }} />}
  </>;
}
