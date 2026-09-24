import { useRef, useState, type KeyboardEvent } from 'react';
import styles from './MessageInput.module.css';

const MAX_MESSAGE_LENGTH = 4000;

type MessageInputProps = {
  onSend: (text: string) => void;
  isSending: boolean;
};

export function MessageInput({ onSend, isSending }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = text.trim().length > 0 && !isSending;

  function submit() {
    if (!canSend) {
      return;
    }
    onSend(text.trim());
    setText('');
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder="Сообщение"
        rows={1}        autoFocus
      />
      <button className={styles.send} type="submit" disabled={!canSend} aria-label="Отправить">
        {isSending ? '…' : '➤'}
      </button>
    </form>
  );
}
