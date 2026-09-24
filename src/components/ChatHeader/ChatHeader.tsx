import type { Chat } from '../../types/chat';
import { formatPhone } from '../../utils/phone';
import styles from './ChatHeader.module.css';

type ChatHeaderProps = {
  chat: Chat;
  isListening: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
};

export function ChatHeader({
  chat,
  isListening,
  isRefreshing,
  onBack,
  onRefresh,
}: ChatHeaderProps) {
  const phone = formatPhone(chat.phone);

  return (
    <header className={styles.header}>
      <button className={styles.back} type="button" onClick={onBack} aria-label="К списку чатов">
        ‹
      </button>
      <div className={styles.avatar} aria-hidden="true">
        {chat.title.replace('+', '').slice(0, 2)}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{chat.title}</span>
        <span className={styles.status}>
          {phone && chat.title !== phone && `${phone} · `}
          {isListening ? 'приём сообщений включён' : 'приём сообщений остановлен'}
        </span>
      </div>
      <button
        className={styles.refresh}
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Обновить историю сообщений"
        aria-label="Обновить историю сообщений"
      >
        ⟳
      </button>
    </header>
  );
}
