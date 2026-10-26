import { useState } from 'react';
import { createGroup } from '../api/groupsApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import ModalFrame from './ModalFrame.jsx';
import MemberPicker from './MemberPicker.jsx';

export default function CreateGroupModal({ onClose, onCreated }) {
  const { t, tError } = useI18n();
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  return <ModalFrame title={t('groups.create')} onClose={onClose}>
    <form onSubmit={async (event) => {
      event.preventDefault(); if (pending) return;
      setPending(true); setError(null);
      try { await onCreated(await createGroup(title.trim(), members.map((user) => user.id))); }
      catch (err) { setError(tError(err)); setPending(false); }
    }}>
      <div className="field"><label htmlFor="group-title">{t('groups.name')}</label><input id="group-title" required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} disabled={pending} autoComplete="off" /></div>
      <h3 className="feature-section-title">{t('groups.members')}</h3>
      <MemberPicker selected={members} onChange={setMembers} disabled={pending} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn-primary" disabled={pending || !title.trim()}>{pending ? t('common.loading') : t('groups.create')}</button>
    </form>
  </ModalFrame>;
}
