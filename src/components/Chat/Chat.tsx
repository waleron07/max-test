import type { Chat as ChatModel, Message } from '../../types/chat';
import { ChatHeader } from '../ChatHeader/ChatHeader';
import { MessageInput } from '../MessageInput/MessageInput';
import { MessageList } from '../MessageList/MessageList';
import { Alert } from '../ui/Alert';
import styles from './Chat.module.css';

type ChatProps = {
  chat: ChatModel;
  messages: Message[];
  isSending: boolean;
  isListening: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClose: () => void;
};

export function Chat({
  chat,
  messages,
  isSending,
  isListening,
  error,
  onSend,
  onClose,
}: ChatProps) {
  return (
    <section className={styles.chat}>
      <ChatHeader chat={chat} isListening={isListening} onClose={onClose} />
      <MessageList messages={messages} />
      {error && (
        <div className={styles.error}>
          <Alert>{error}</Alert>
        </div>
      )}
      <MessageInput onSend={onSend} isSending={isSending} />
    </section>
  );
}
