import { describe, expect, it } from 'vitest';
import { buildChatId, formatPhone, isValidPhone, normalizePhone } from '../phone';

describe('phone', () => {
  it('нормализует номер до цифр', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone(79991234567)).toBe('79991234567');
    expect(normalizePhone(undefined)).toBe('');
  });

  it('валидирует длину номера', () => {
    expect(isValidPhone('79991234567')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
  });

  it('строит chatId индивидуального чата', () => {
    expect(buildChatId('+7 999 123 45 67')).toBe('79991234567@c.us');
  });

  it('форматирует номер для отображения', () => {
    expect(formatPhone('79991234567')).toBe('+79991234567');
  });
});
