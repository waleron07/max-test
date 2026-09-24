export type MessageDirection = 'incoming' | 'outgoing';

export type MessageStatus = 'sending' | 'sent' | 'failed';

export type Message = {
  id: string;
  text: string;
  direction: MessageDirection;
  /** Unix-время в секундах, как его отдаёт GREEN-API. */
  timestamp: number;
  senderName?: string;
  status?: MessageStatus;
};

export type Chat = {
  /** chatId, который отправляется в API: `<phone>@c.us`. */
  chatId: string;
  /** Только цифры, используется для сопоставления входящих уведомлений. */
  phone: string;
  title: string;
};
