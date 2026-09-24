import { describe, expect, it } from 'vitest';
import { buildChatId, formatPhone, normalizePhone } from '../phone';
import { DEFAULT_COUNTRY, countryByCode, formatNational, nationalLength } from '../countries';

describe('phone', () => {
  it('нормализует номер до цифр', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone(79991234567)).toBe('79991234567');
    expect(normalizePhone(undefined)).toBe('');
  });

  it('строит chatId индивидуального чата', () => {
    expect(buildChatId('+7 999 123 45 67')).toBe('79991234567@c.us');
  });

  it('форматирует номер для отображения', () => {
    expect(formatPhone('79991234567')).toBe('+79991234567');
  });
});

describe('countries', () => {
  it('форматирует национальную часть по маске страны', () => {
    expect(formatNational('9991234567', countryByCode('RU'))).toBe('999 123 45 67');
    expect(formatNational('999', countryByCode('RU'))).toBe('999');
    expect(formatNational('', countryByCode('RU'))).toBe('');
  });

  it('не выходит за пределы маски', () => {
    expect(formatNational('99912345679999', countryByCode('RU'))).toBe('999 123 45 67');
  });

  it('знает длину национальной части', () => {
    expect(nationalLength(countryByCode('RU'))).toBe(10);
    expect(nationalLength(countryByCode('BY'))).toBe(9);
  });

  it('откатывается к стране по умолчанию для неизвестного кода', () => {
    expect(countryByCode('XX')).toBe(DEFAULT_COUNTRY);
  });
});
