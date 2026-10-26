import { useI18n } from '../i18n/I18nProvider.jsx';
import Avatar from './Avatar.jsx';
import UserSearch from './UserSearch.jsx';

export default function MemberPicker({ selected, onChange, excludeIds = [], disabled = false }) {
  const { t } = useI18n();
  return <div className="member-picker">
    <div className="member-picker__chips">{selected.map((user) => <button type="button" key={user.id} className="member-chip" disabled={disabled} onClick={() => onChange(selected.filter((item) => item.id !== user.id))}>
      <Avatar name={user.displayName} seed={user.id} src={user.avatarUrl} size={24} />{user.displayName}<span aria-hidden="true">×</span>
    </button>)}</div>
    {!disabled && <UserSearch key={selected.map((user) => user.id).join(',')} excludeIds={[...excludeIds, ...selected.map((user) => user.id)]} onSelect={(user) => onChange([...selected, user])} />}
    <p className="field__hint">{t('groups.pickerHint')}</p>
  </div>;
}
