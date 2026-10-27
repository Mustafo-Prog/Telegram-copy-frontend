import { useI18n } from '../i18n/I18nProvider.jsx';
import { BookmarkIcon, SendIcon } from './icons.jsx';

export default function ChatEmptyState({ choose = false, demo = false, saved = false }) {
  const { t } = useI18n();
  return (
    <div className={`chat-empty${choose ? ' chat-empty--choose' : ''}`}>
      <div className="chat-empty__art" aria-hidden="true">{saved ? <BookmarkIcon width={38} height={38} /> : <SendIcon width={38} height={38} />}</div>
      <h2>{t(saved ? 'saved.emptyTitle' : choose ? 'chat.chooseTitle' : 'chat.emptyTitle')}</h2>
      <p>{t(saved ? 'saved.emptyHint' : choose ? (demo ? 'chat.demoHint' : 'chat.chooseHint') : 'chat.startHint')}</p>
      <div className="chat-empty__features">
        <span>{t('chat.featureReply')}</span><span>{t('chat.featureFiles')}</span>
        <span>{t('chat.featurePrivacy')}</span>
      </div>
    </div>
  );
}
