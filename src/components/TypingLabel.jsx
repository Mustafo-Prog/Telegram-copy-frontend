import { useI18n } from '../i18n/I18nProvider.jsx';
import { useTyping } from '../realtime/typing.js';

export default function TypingLabel({ channel, userId, children }) {
  const { t } = useI18n();
  const people = useTyping(channel).filter((person) => person.userId !== userId);
  if (!people.length) return children;
  const label = people.length === 1 ? t('typing.one', { name: people[0].displayName }) :
    people.length === 2 ? t('typing.two', { names: people.map((person) => person.displayName).join(', ') }) : t('typing.many');
  return <span className="typing-label" role="status">{label}<span aria-hidden="true" className="typing-label__dots">•••</span></span>;
}
