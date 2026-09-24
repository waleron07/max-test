import type { Chat, Message, MessageStatus } from '../types/chat';
import type { ChatSummary, HistoryMessage, NotificationBody } from '../types/greenApi';
import { MESSAGE_STATUSES } from './notifications';
import { formatPhone, normalizePhone } from './phone';

/** Личные чаты; группы и каналы заданием не предусмотрены. */
export function toChat(summary: ChatSummary): Chat | null {
  const chatId = summary.chatId ?? summary.id;
  const isGroup = (summary.type && summary.type !== 'user') || chatId?.endsWith('@g.us');
  if (!chatId || isGroup) {
    return null;
  }
  // У WhatsApp номер телефона отдельным полем не приходит — он и есть идентификатор чата.
  const phone = normalizePhone(summary.phoneNumber) || normalizePhone(chatId.split('@')[0]);
  return {
    chatId,
    phone,
    title: summary.name || formatPhone(phone) || chatId,
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

/**
 * Статус исходящего сообщения: основной источник — statusMessage, но GREEN-API отдаёт ещё
 * недокументированный isRead, и он точнее, когда отслеживание статусов инстансом отключено.
 */
function historyStatus(item: HistoryMessage): MessageStatus {
  if (item.isRead) {
    return 'read';
  }
  return MESSAGE_STATUSES[item.statusMessage ?? ''] ?? 'sent';
}

/** Из ответа GetChatHistory оставляем только текстовые сообщения, от старых к новым. */
export function historyToMessages(history: HistoryMessage[]): Message[] {
  return history
    .filter((item): item is HistoryMessage & { idMessage: string } =>
      !item.isDeleted
      && (item.typeMessage === 'textMessage' || item.typeMessage === 'extendedTextMessage')
      && Boolean(item.idMessage)
      && Boolean(item.textMessage ?? item.extendedTextMessage?.text))
    .map((item) => ({
      id: item.idMessage,
      text: item.textMessage ?? item.extendedTextMessage?.text ?? '',
      direction: item.type === 'incoming' ? ('incoming' as const) : ('outgoing' as const),
      timestamp: item.timestamp ?? 0,
      senderName: item.type === 'incoming'
        ? item.senderContactName || item.senderName
        : undefined,
      status: item.type === 'incoming' ? undefined : historyStatus(item),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Объединяет списки сообщений: дубли по idMessage схлопываются, порядок — по времени. */
export function mergeMessages(base: Message[], incoming: Message[]): Message[] {
  return incoming
    .reduce(appendMessage, base)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Раскладывает сообщения журналов по чатам. */
export function groupMessagesByChat(items: HistoryMessage[]): Record<string, Message[]> {
  const result: Record<string, Message[]> = {};

  for (const item of items) {
    if (!item.chatId) {
      continue;
    }
    const [message] = historyToMessages([item]);
    if (message) {
      result[item.chatId] = mergeMessages(result[item.chatId] ?? [], [message]);
    }
  }

  return result;
}

/** Добавляет сообщение, не создавая дублей по idMessage. */
export function appendMessage(messages: Message[], message: Message): Message[] {
  return messages.some((item) => item.id === message.id)
    ? messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
    : [...messages, message];
}

/**
 * Свежие переписки сверху. Время берётся из последнего известного сообщения;
 * чаты без загруженных сообщений сохраняют порядок, в котором их вернул GetChats.
 */
export function sortChatsByLastMessage(
  chats: Chat[],
  lastMessages: Record<string, Message | undefined>,
): Chat[] {
  return [...chats].sort((a, b) =>
    (lastMessages[b.chatId]?.timestamp ?? 0) - (lastMessages[a.chatId]?.timestamp ?? 0),
  );
}

export function upsertChat(chats: Chat[], chat: Chat): Chat[] {
  const index = chats.findIndex((item) => item.chatId === chat.chatId);
  if (index === -1) {
    return [chat, ...chats];
  }
  const merged = { ...chats[index], ...chat };
  return chats.map((item, position) => (position === index ? merged : item));
}
