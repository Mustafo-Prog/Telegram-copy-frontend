import { useQuery } from '@tanstack/react-query';
import { getMessages } from '../api/messagesApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import Avatar from './Avatar.jsx';

export default function ChatList() {
  const { t, formatTime } = useI18n();
  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: getMessages,
    refetchInterval: 3000,
  });

  const last = messages[messages.length - 1];
  const groupName = t('chat.groupName');
  const preview = last
    ? `${last.senderName ?? t('chat.deletedUser')}: ${last.text}`
    : t('chat.noMessages');

  return (
    <ul className="chat-list">
      <li className="chat-list__item chat-list__item--active" aria-current="true">
        <Avatar name={groupName} seed="group" size={48} />
        <div className="chat-list__body">
          <div className="chat-list__top">
            <span className="chat-list__name">{groupName}</span>
            {last && <span className="chat-list__time">{formatTime(last.createdAt)}</span>}
          </div>
          <div className="chat-list__preview">{preview}</div>
        </div>
      </li>
    </ul>
  );
}
