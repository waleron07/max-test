import type { Chat as ChatModel, Message } from '../../types/chat';
import { ChatHeader } from '../ChatHeader/ChatHeader';
import { MessageInput } from '../MessageInput/MessageInput';
import { MessageList } from '../MessageList/MessageList';
import { Alert } from '../ui/Alert';
import styles from './Chat.module.css';

type ChatProps = {
  chat: ChatModel;
  messages: Message[];
  isLoadingHistory: boolean;
  isSending: boolean;
  isListening: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onBack: () => void;
};

export function Chat({
  chat,
  messages,
  isLoadingHistory,
  isSending,
  isListening,
  error,
  onSend,
  onBack,
}: ChatProps) {
  return (
    <section className={styles.chat}>
      <ChatHeader chat={chat} isListening={isListening} onBack={onBack} />
      {isLoadingHistory ? (
        <p className={styles.loading}>Загружаем историю сообщений…</p>
      ) : (
        <MessageList messages={messages} />
      )}
      {error && (
        <div className={styles.error}>
          <Alert>{error}</Alert>
        </div>
      )}
      <MessageInput onSend={onSend} isSending={isSending} />
    </section>
  );
}
