import type { Chat } from '../../types/chat';
import { formatPhone } from '../../utils/phone';
import styles from './ChatHeader.module.css';

type ChatHeaderProps = {
  chat: Chat;
  isListening: boolean;
  onClose: () => void;
};

export function ChatHeader({ chat, isListening, onClose }: ChatHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.avatar} aria-hidden="true">
        {chat.title.slice(-2)}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{formatPhone(chat.phone)}</span>
        <span className={styles.status}>
          {isListening ? 'Слушаем входящие сообщения' : 'Получение сообщений остановлено'}
        </span>
      </div>
      <button className={styles.close} type="button" onClick={onClose}>
        Закрыть
      </button>
    </header>
  );
}
