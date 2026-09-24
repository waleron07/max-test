import type { Chat, Message } from '../types/chat';
import type { ChatSummary, HistoryMessage, NotificationBody } from '../types/greenApi';
import { formatPhone, normalizePhone } from './phone';

/** Личные чаты; группы и каналы заданием не предусмотрены. */
export function toChat(summary: ChatSummary): Chat | null {
  if (!summary.chatId || (summary.type && summary.type !== 'user')) {
    return null;
  }
  const phone = normalizePhone(summary.phoneNumber);
  return {
    chatId: summary.chatId,
    phone,
    title: summary.name || formatPhone(phone) || summary.chatId,
  };
}

/** Чат, созданный по входящему сообщению от неизвестного собеседника. */
export function chatFromNotification(body: NotificationBody): Chat | null {
  const senderData = body.senderData;
  if (!senderData?.chatId || (senderData.chatType && senderData.chatType !== 'user')) {
    return null;
  }
  const phone = normalizePhone(senderData.senderPhoneNumber);
  return {
    chatId: senderData.chatId,
    phone,
    title: senderData.senderContactName
      || senderData.senderName
      || senderData.chatName
      || formatPhone(phone)
      || senderData.chatId,
  };
}

/** Из ответа GetChatHistory оставляем только текстовые сообщения, от старых к новым. */
export function historyToMessages(history: HistoryMessage[]): Message[] {
  return history
    .filter((item): item is HistoryMessage & { idMessage: string; textMessage: string } =>
      item.typeMessage === 'textMessage'
      && Boolean(item.idMessage)
      && Boolean(item.textMessage))
    .map((item) => ({
      id: item.idMessage,
      text: item.textMessage,
      direction: item.type === 'incoming' ? ('incoming' as const) : ('outgoing' as const),
      timestamp: item.timestamp ?? 0,
      senderName: item.type === 'incoming'
        ? item.senderContactName || item.senderName
        : undefined,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Добавляет сообщение, не создавая дублей по idMessage. */
export function appendMessage(messages: Message[], message: Message): Message[] {
  return messages.some((item) => item.id === message.id)
    ? messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
    : [...messages, message];
}

export function upsertChat(chats: Chat[], chat: Chat): Chat[] {
  const index = chats.findIndex((item) => item.chatId === chat.chatId);
  if (index === -1) {
    return [chat, ...chats];
  }
  const merged = { ...chats[index], ...chat };
  return chats.map((item, position) => (position === index ? merged : item));
}
