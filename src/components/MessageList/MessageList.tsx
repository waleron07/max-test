import { useEffect, useRef } from 'react';
import type { Message } from '../../types/chat';
import { formatMessageTime } from '../../utils/notifications';
import styles from './MessageList.module.css';

type MessageListProps = {
  messages: Message[];
};

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Сообщений пока нет</p>
        <p className={styles.emptyHint}>Отправьте первое сообщение, чтобы начать диалог</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {messages.map((message) => (
        <article
          key={message.id}
          className={`${styles.bubble} ${styles[message.direction]} ${
            message.status === 'failed' ? styles.failed : ''
          }`}
        >
          {message.senderName && <span className={styles.sender}>{message.senderName}</span>}
          <p className={styles.text}>{message.text}</p>
          <span className={styles.meta}>
            {formatMessageTime(message.timestamp)}
            {message.status === 'sending' && ' · отправка…'}
            {message.status === 'failed' && ' · не отправлено'}
          </span>
        </article>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
