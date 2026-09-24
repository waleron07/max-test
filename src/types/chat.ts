export type MessageDirection = 'incoming' | 'outgoing';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

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
  /** Идентификатор чата в GREEN-API: числовой id MAX или `<phone>@c.us`. */
  chatId: string;
  /** Только цифры; пустая строка, если номер скрыт. */
  phone: string;
  title: string;
};
