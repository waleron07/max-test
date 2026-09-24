import { useState, type FormEvent } from 'react';
import { DEFAULT_COUNTRY, nationalLength, type Country } from '../../utils/countries';
import { PhoneInput } from '../PhoneInput/PhoneInput';
import { Alert } from '../ui/Alert';
import styles from './NewChatForm.module.css';

type NewChatFormProps = {
  onOpenChat: (phone: string) => void;
  isOpening?: boolean;
  /** Ошибка проверки номера на стороне GREEN-API. */
  error?: string | null;
  /** Вызывается при правке номера, чтобы владелец сбросил свою ошибку. */
  onEdit?: () => void;
};

export function NewChatForm({
  onOpenChat,
  isOpening = false,
  error = null,
  onEdit,
}: NewChatFormProps) {
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [national, setNational] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isComplete = national.length === nationalLength(country);
  const shownError = localError ?? error;

  function handleCountryChange(next: Country) {
    setCountry(next);
    setNational((prev) => prev.slice(0, nationalLength(next)));
    setLocalError(null);
    onEdit?.();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isOpening) {
      return;
    }
    if (!isComplete) {
      setLocalError('Введите номер получателя полностью');
      return;
    }
    setLocalError(null);
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
            setLocalError(null);
            onEdit?.();
          }}
          disabled={isOpening}
        />
        <button className={styles.submit} type="submit" disabled={isOpening || !isComplete}>
          {isOpening ? 'Проверяем…' : 'Открыть'}
        </button>
      </div>

      {shownError && <Alert>{shownError}</Alert>}
    </form>
  );
}
