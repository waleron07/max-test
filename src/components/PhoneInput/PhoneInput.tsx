import { COUNTRIES, countryByCode, formatNational, nationalLength, type Country } from '../../utils/countries';
import { normalizePhone } from '../../utils/phone';
import styles from './PhoneInput.module.css';

type PhoneInputProps = {
  country: Country;
  national: string;
  onCountryChange: (country: Country) => void;
  onNationalChange: (digits: string) => void;
  disabled?: boolean;
};

export function PhoneInput({
  country,
  national,
  onCountryChange,
  onNationalChange,
  disabled = false,
}: PhoneInputProps) {
  function handleInput(value: string) {
    onNationalChange(normalizePhone(value).slice(0, nationalLength(country)));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.country}>
        <span aria-hidden="true">{country.flag}</span>
        <span className={styles.dial}>+{country.dial}</span>
        <select
          className={styles.select}
          value={country.code}
          onChange={(event) => onCountryChange(countryByCode(event.target.value))}
          disabled={disabled}
          aria-label="Код страны"
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.flag} {item.name} +{item.dial}
            </option>
          ))}
        </select>
      </div>

      <input
        className={styles.input}
        value={formatNational(national, country)}
        onChange={(event) => handleInput(event.target.value)}
        placeholder={formatNational('1234567890123', country)}
        inputMode="tel"
        autoComplete="off"
        disabled={disabled}
        aria-label="Номер телефона"
      />
    </div>
  );
}
