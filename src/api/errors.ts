export class GreenApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Некорректный запрос к GREEN-API. Проверьте номер получателя.',
  401: 'Неверный idInstance или apiTokenInstance.',
  403: 'Доступ запрещён: проверьте права инстанса и оплату тарифа.',
  404: 'Инстанс не найден. Проверьте idInstance и адрес API.',
  429: 'Превышен лимит запросов к GREEN-API. Попробуйте позже.',
  466: 'Исчерпан лимит сообщений или инстанс не оплачен.',
};

export function toUserMessage(error: unknown): string {
  if (error instanceof GreenApiError) {
    if (error.status && STATUS_MESSAGES[error.status]) {
      return STATUS_MESSAGES[error.status];
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    // fetch бросает TypeError и при офлайне, и при блокировке CORS.
    return 'Сеть недоступна: не удалось связаться с GREEN-API.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка.';
}
