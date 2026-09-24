import type { Chat, Message, MessageDirection, MessageStatus } from '../types/chat';
import type { NotificationBody } from '../types/greenApi';
import { normalizePhone } from './phone';

const DIRECTION_BY_WEBHOOK: Record<string, MessageDirection> = {
  incomingMessageReceived: 'incoming',
  outgoingMessageReceived: 'outgoing',
  outgoingAPIMessageReceived: 'outgoing',
};

/** https://green-api.com/v3/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/ */
export const MESSAGE_STATUSES: Record<string, MessageStatus> = {
  pending: 'sending',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
};

export type StatusUpdate = {
  idMessage: string;
  status: MessageStatus;
};

/** Статус ранее отправленного сообщения: доставлено, прочитано или не доставлено. */
export function toStatusUpdate(body: NotificationBody): StatusUpdate | null {
  if (body.typeWebhook !== 'outgoingMessageStatus' || !body.idMessage || !body.status) {
    return null;
  }
  const status = MESSAGE_STATUSES[body.status];
  return status ? { idMessage: body.idMessage, status } : null;
}

/** Превращает уведомление в сообщение приложения; всё нетекстовое отбрасывается. */
export function toMessage(body: NotificationBody): Message | null {
  const direction = DIRECTION_BY_WEBHOOK[body.typeWebhook];
  if (!direction) {
    return null;
  }

  const messageData = body.messageData;
  if (messageData?.typeMessage !== 'textMessage'
    && messageData?.typeMessage !== 'extendedTextMessage') {
    return null;
  }

  // Сообщение со ссылкой приходит как extendedTextMessage — для чата это тот же текст.
  const text = messageData.textMessageData?.textMessage
    ?? messageData.extendedTextMessageData?.text;
  if (typeof text !== 'string' || !text) {
    return null;
  }

  if (!body.idMessage || !body.senderData?.chatId) {
    return null;
  }

  return {
    id: body.idMessage,
    text,
    direction,
    timestamp: body.timestamp ?? Math.floor(Date.now() / 1000),
    senderName: direction === 'incoming'
      ? body.senderData.senderContactName || body.senderData.senderName
      : undefined,
  };
}

/**
 * Исходящий chatId строится из номера (`79991234567@c.us`), а в уведомлениях MAX
 * приходит числовой идентификатор чата, поэтому входящие сравниваем ещё и по телефону отправителя.
 */
export function belongsToChat(body: NotificationBody, chat: Chat): boolean {
  const senderData = body.senderData;
  if (!senderData) {
    return false;
  }

  if (senderData.chatId === chat.chatId) {
    return true;
  }

  const chatIdDigits = normalizePhone(senderData.chatId);
  if (chatIdDigits && chatIdDigits === chat.phone) {
    return true;
  }

  if (DIRECTION_BY_WEBHOOK[body.typeWebhook] === 'incoming') {
    return normalizePhone(senderData.senderPhoneNumber) === chat.phone;
  }

  return false;
}

export function formatMessageTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
