/** Оставляет только цифры: `+7 (999) 123-45-67` → `79991234567`. */
export function normalizePhone(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

/**
 * chatId индивидуального чата в формате GREEN-API: `79991234567@c.us`.
 * https://green-api.com/v3/docs/api/chat-id/
 */
export function buildChatId(phone: string): string {
  return `${normalizePhone(phone)}@c.us`;
}

/**
 * CheckAccount принимает только номера России и Беларуси
 * (https://green-api.com/v3/docs/api/service/CheckAccount/), для остальных проверку пропускаем.
 */
export function canCheckAccount(phone: string): boolean {
  const digits = normalizePhone(phone);
  return (digits.startsWith('7') && digits.length === 11)
    || (digits.startsWith('375') && digits.length === 12);
}

export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  return digits ? `+${digits}` : '';
}
