import { useEffect, useRef } from 'react';
import type { Message, MessageStatus } from '../../types/chat';
import { formatMessageTime } from '../../utils/notifications';
import styles from './MessageList.module.css';

/** Как в MAX: одна галочка — отправлено, две — доставлено, две цветные — прочитано. */
function StatusTicks({ status }: { status?: MessageStatus }) {
  if (!status || status === 'sending') {
    return <span className={styles.ticks}>⏱</span>;
  }
  if (status === 'failed') {
    return null;
  }
  return (
    <span
      className={`${styles.ticks} ${status === 'read' ? styles.read : ''}`}
      title={status === 'read' ? 'Прочитано' : status === 'delivered' ? 'Доставлено' : 'Отправлено'}
    >
      {status === 'sent' ? '✓' : '✓✓'}
    </span>
  );
}

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
            {message.status === 'failed' && ' · не отправлено'}
            {message.direction === 'outgoing' && message.status !== 'failed' && (
              <StatusTicks status={message.status} />
            )}
          </span>
        </article>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
