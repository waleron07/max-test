import type { Chat, Message } from '../../types/chat';
import { formatPhone } from '../../utils/phone';
import styles from './ChatList.module.css';

type ChatListProps = {
  chats: Chat[];
  activeChatId: string | null;
  lastMessages: Record<string, Message | undefined>;
  unread: Record<string, number>;
  isLoading: boolean;
  onSelect: (chat: Chat) => void;
};

export function ChatList({
  chats,
  activeChatId,
  lastMessages,
  unread,
  isLoading,
  onSelect,
}: ChatListProps) {
  if (isLoading && chats.length === 0) {
    return <p className={styles.placeholder}>Загружаем чаты…</p>;
  }

  if (chats.length === 0) {
    return <p className={styles.placeholder}>Чатов пока нет — начните новый по номеру телефона</p>;
  }

  return (
    <ul className={styles.list}>
      {chats.map((chat) => {
        const preview = lastMessages[chat.chatId];
        const unreadCount = unread[chat.chatId] ?? 0;

        return (
          <li key={chat.chatId}>
            <button
              type="button"
              className={`${styles.item} ${chat.chatId === activeChatId ? styles.active : ''}`}
              onClick={() => onSelect(chat)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {chat.title.replace('+', '').slice(0, 2)}
              </span>
              <span className={styles.body}>
                <span className={styles.title}>{chat.title}</span>
                <span className={styles.preview}>
                  {preview
                    ? `${preview.direction === 'outgoing' ? 'Вы: ' : ''}${preview.text}`
                    : formatPhone(chat.phone) || 'Нет сообщений'}
                </span>
              </span>
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
