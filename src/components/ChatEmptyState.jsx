import { useI18n } from '../i18n/I18nProvider.jsx';
import { SendIcon } from './icons.jsx';

export default function ChatEmptyState({ choose = false, demo = false }) {
  const { t } = useI18n();
  return (
    <div className={`chat-empty${choose ? ' chat-empty--choose' : ''}`}>
      <div className="chat-empty__art" aria-hidden="true"><SendIcon width={38} height={38} /></div>
      <h2>{t(choose ? 'chat.chooseTitle' : 'chat.emptyTitle')}</h2>
      <p>{t(choose ? (demo ? 'chat.demoHint' : 'chat.chooseHint') : 'chat.startHint')}</p>
      <div className="chat-empty__features">
        <span>{t('chat.featureReply')}</span><span>{t('chat.featureFiles')}</span>
        <span>{t('chat.featurePrivacy')}</span>
      </div>
    </div>
  );
}
