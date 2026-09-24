export type Country = {
  code: string;
  name: string;
  /** Телефонный код без «+». */
  dial: string;
  flag: string;
  /** Маска национальной части: `#` — цифра, остальное — разделители. */
  mask: string;
};

/** Страны, из которых MAX разрешает вход; порядок — как в самом мессенджере. */
export const COUNTRIES: Country[] = [
  { code: 'RU', name: 'Россия', dial: '7', flag: '🇷🇺', mask: '### ### ## ##' },
  { code: 'BY', name: 'Беларусь', dial: '375', flag: '🇧🇾', mask: '## ### ## ##' },
  { code: 'KZ', name: 'Казахстан', dial: '7', flag: '🇰🇿', mask: '### ### ## ##' },
  { code: 'AM', name: 'Армения', dial: '374', flag: '🇦🇲', mask: '## ## ## ##' },
  { code: 'AZ', name: 'Азербайджан', dial: '994', flag: '🇦🇿', mask: '## ### ## ##' },
  { code: 'GE', name: 'Грузия', dial: '995', flag: '🇬🇪', mask: '### ## ## ##' },
  { code: 'KG', name: 'Кыргызстан', dial: '996', flag: '🇰🇬', mask: '### ### ###' },
  { code: 'MD', name: 'Молдова', dial: '373', flag: '🇲🇩', mask: '#### ####' },
  { code: 'TJ', name: 'Таджикистан', dial: '992', flag: '🇹🇯', mask: '## ### ####' },
  { code: 'TM', name: 'Туркменистан', dial: '993', flag: '🇹🇲', mask: '## ######' },
  { code: 'UZ', name: 'Узбекистан', dial: '998', flag: '🇺🇿', mask: '## ### ## ##' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function countryByCode(code: string): Country {
  return COUNTRIES.find((country) => country.code === code) ?? DEFAULT_COUNTRY;
}

export function nationalLength(country: Country): number {
  return country.mask.replace(/[^#]/g, '').length;
}

/** Расставляет разделители маски: `9991234567` + `### ### ## ##` → `999 123 45 67`. */
export function formatNational(digits: string, country: Country): string {
  let result = '';
  let index = 0;

  for (const symbol of country.mask) {
    if (index >= digits.length) {
      break;
    }
    if (symbol === '#') {
      result += digits[index];
      index += 1;
    } else {
      result += symbol;
    }
  }

  return result;
}
