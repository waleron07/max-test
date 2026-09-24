import { useState } from 'react';
import { DEFAULT_API_URL } from '../../api/greenApi';
import type { Credentials } from '../../types/greenApi';
import { Alert } from '../ui/Alert';
import styles from './CredentialsForm.module.css';

type CredentialsFormProps = {
  onConnect: (credentials: Credentials) => void;
  isConnecting: boolean;
  error: string | null;
};

export function CredentialsForm({ onConnect, isConnecting, error }: CredentialsFormProps) {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);

  const isValid = Boolean(idInstance.trim() && apiTokenInstance.trim() && apiUrl.trim());

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid || isConnecting) {
      return;
    }
    onConnect({
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl.trim(),
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div>
        <h1 className={styles.title}>MAX Chat</h1>
        <p className={styles.subtitle}>
          Введите параметры инстанса из личного кабинета GREEN-API
        </p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>idInstance</span>
        <input
          className={styles.input}
          value={idInstance}
          onChange={(event) => setIdInstance(event.target.value)}
          placeholder="1101000001"
          inputMode="numeric"
          autoComplete="off"
          disabled={isConnecting}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>apiTokenInstance</span>
        <input
          className={styles.input}
          type="password"
          value={apiTokenInstance}
          onChange={(event) => setApiTokenInstance(event.target.value)}
          placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
          autoComplete="off"
          disabled={isConnecting}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>apiUrl</span>
        <input
          className={styles.input}
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value)}
          autoComplete="off"
          disabled={isConnecting}
        />
        <span className={styles.hint}>
          Адрес хоста API указан в личном кабинете рядом с инстансом
        </span>
      </label>

      {error && <Alert>{error}</Alert>}

      <button className={styles.submit} type="submit" disabled={!isValid || isConnecting}>
        {isConnecting ? 'Подключение…' : 'Подключиться'}
      </button>

      <p className={styles.note}>
        Данные инстанса хранятся только в памяти вкладки и никуда, кроме GREEN-API, не отправляются.
      </p>
    </form>
  );
}
