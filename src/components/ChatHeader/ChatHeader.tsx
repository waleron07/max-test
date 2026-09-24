import type { Chat } from '../../types/chat';
import { formatPhone } from '../../utils/phone';
import styles from './ChatHeader.module.css';

type ChatHeaderProps = {
  chat: Chat;
  isListening: boolean;
  onClose: () => void;
};

export function ChatHeader({ chat, isListening, onClose }: ChatHeaderProps) {
  const phone = formatPhone(chat.phone);

  return (
    <header className={styles.header}>
      <div className={styles.avatar} aria-hidden="true">
        {chat.title.replace('+', '').slice(0, 2)}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{chat.title}</span>
        <span className={styles.status}>
          {chat.title !== phone && `${phone} · `}
          {isListening ? 'приём сообщений включён' : 'приём сообщений остановлен'}
        </span>
      </div>
      <button className={styles.close} type="button" onClick={onClose}>
        Закрыть
      </button>
    </header>
  );
}
