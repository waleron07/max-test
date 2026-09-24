import { useState, type FormEvent } from 'react';
import { DEFAULT_COUNTRY, nationalLength, type Country } from '../../utils/countries';
import { PhoneInput } from '../PhoneInput/PhoneInput';
import { Alert } from '../ui/Alert';
import styles from './NewChatForm.module.css';

type NewChatFormProps = {
  onOpenChat: (phone: string) => void;
  disabled?: boolean;
};

export function NewChatForm({ onOpenChat, disabled = false }: NewChatFormProps) {
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [national, setNational] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isComplete = national.length === nationalLength(country);

  function handleCountryChange(next: Country) {
    setCountry(next);
    setNational((prev) => prev.slice(0, nationalLength(next)));
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    if (!isComplete) {
      setError('Введите номер получателя полностью');
      return;
    }
    setError(null);
    onOpenChat(`${country.dial}${national}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Новый чат</h2>
      <p className={styles.subtitle}>С каким номером хотите начать переписку?</p>

      <div className={styles.row}>
        <PhoneInput
          country={country}
          national={national}
          onCountryChange={handleCountryChange}
          onNationalChange={(digits) => {
            setNational(digits);
            setError(null);
          }}
          disabled={disabled}
        />
        <button className={styles.submit} type="submit" disabled={disabled || !isComplete}>
          Открыть
        </button>
      </div>

      {error && <Alert>{error}</Alert>}
    </form>
  );
}
