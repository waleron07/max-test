import { useState, type FormEvent } from 'react';
import { isValidPhone, normalizePhone } from '../../utils/phone';
import { Alert } from '../ui/Alert';
import styles from './NewChatForm.module.css';

type NewChatFormProps = {
  onOpenChat: (phone: string) => void;
  disabled?: boolean;
};

export function NewChatForm({ onOpenChat, disabled = false }: NewChatFormProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Введите номер в международном формате, например 79991234567');
      return;
    }
    setError(null);
    onOpenChat(normalizePhone(phone));
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Новый чат</h2>
      <p className={styles.subtitle}>Номер получателя в MAX</p>

      <div className={styles.row}>
        <input
          className={styles.input}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="79991234567"
          inputMode="tel"
          autoComplete="off"
          disabled={disabled}
        />
        <button className={styles.submit} type="submit" disabled={disabled || !phone.trim()}>
          Открыть
        </button>
      </div>

      {error && <Alert>{error}</Alert>}
    </form>
  );
}
