import { describe, expect, it } from 'vitest';
import {
  appendMessage,
  chatFromNotification,
  groupMessagesByChat,
  historyToMessages,
  mergeMessages,
  sortChatsByLastMessage,
  toChat,
  upsertChat,
} from '../chats';
import type { Chat, Message } from '../../types/chat';

describe('toChat', () => {
  it('превращает личный чат в модель приложения', () => {
    expect(toChat({ chatId: '10000000', name: 'Иван', type: 'user', phoneNumber: 79991234567 }))
      .toEqual({ chatId: '10000000', phone: '79991234567', title: 'Иван' });
  });

  it('подставляет номер, если имя не пришло', () => {
    expect(toChat({ chatId: '10000000', type: 'user', phoneNumber: 79991234567 })?.title)
      .toBe('+79991234567');
  });

  it('понимает формат WhatsApp, где идентификатор лежит в id', () => {
    expect(toChat({ id: '79876543210@c.us', name: 'John Doe', type: 'user' }))
      .toEqual({ chatId: '79876543210@c.us', phone: '79876543210', title: 'John Doe' });
  });

  it('отбрасывает групповые чаты WhatsApp по суффиксу @g.us', () => {
    expect(toChat({ id: '79001234567-1581234048@g.us', name: 'Группа' })).toBeNull();
  });

  it('отбрасывает группы и каналы', () => {
    expect(toChat({ chatId: '-100', name: 'Группа', type: 'group' })).toBeNull();
  });
});

describe('chatFromNotification', () => {
  it('создаёт чат по входящему сообщению от неизвестного собеседника', () => {
    expect(chatFromNotification({
      typeWebhook: 'incomingMessageReceived',
      senderData: {
        chatId: '10000000',
        senderName: 'Иван',
        senderContactName: 'Иван Контакт',
        senderPhoneNumber: 79991234567,
      },
    })).toEqual({ chatId: '10000000', phone: '79991234567', title: 'Иван Контакт' });
  });

  it('игнорирует уведомления без отправителя', () => {
    expect(chatFromNotification({ typeWebhook: 'stateInstanceChanged' })).toBeNull();
  });
});

describe('historyToMessages', () => {
  it('оставляет текстовые сообщения и сортирует по времени', () => {
    const messages = historyToMessages([
      { type: 'outgoing', idMessage: '2', timestamp: 200, typeMessage: 'textMessage', textMessage: 'второе' },
      { type: 'incoming', idMessage: '1', timestamp: 100, typeMessage: 'textMessage', textMessage: 'первое', senderName: 'Иван' },
      { type: 'incoming', idMessage: '3', timestamp: 300, typeMessage: 'imageMessage' },
    ]);

    expect(messages.map((item) => item.id)).toEqual(['1', '2']);
    expect(messages[0]).toEqual({
      id: '1',
      text: 'первое',
      direction: 'incoming',
      timestamp: 100,
      senderName: 'Иван',
    });
    expect(messages[1].senderName).toBeUndefined();
  });

  it('берёт текст сообщения со ссылкой из extendedTextMessage', () => {
    const [message] = historyToMessages([
      {
        type: 'incoming',
        idMessage: '1',
        timestamp: 1,
        typeMessage: 'extendedTextMessage',
        extendedTextMessage: { text: 'https://green-api.com' },
      },
    ]);
    expect(message.text).toBe('https://green-api.com');
  });

  it('не показывает удалённые сообщения', () => {
    expect(historyToMessages([
      { type: 'incoming', idMessage: '1', timestamp: 1, typeMessage: 'textMessage', textMessage: 'т', isDeleted: true },
    ])).toEqual([]);
  });

  it('переносит статус доставки исходящих сообщений', () => {
    const [message] = historyToMessages([
      { type: 'outgoing', idMessage: '1', timestamp: 1, typeMessage: 'textMessage', textMessage: 'а', statusMessage: 'read' },
    ]);
    expect(message.status).toBe('read');
  });
});

describe('appendMessage', () => {
  const message: Message = { id: '1', text: 'привет', direction: 'incoming', timestamp: 1 };

  it('добавляет новое сообщение', () => {
    expect(appendMessage([], message)).toHaveLength(1);
  });

  it('не создаёт дубль по idMessage', () => {
    const updated = appendMessage([message], { ...message, text: 'привет!' });
    expect(updated).toHaveLength(1);
    expect(updated[0].text).toBe('привет!');
  });
});

describe('upsertChat', () => {
  const chat: Chat = { chatId: '10000000', phone: '79991234567', title: '+79991234567' };

  it('добавляет чат в начало списка', () => {
    expect(upsertChat([], chat)).toEqual([chat]);
  });

  it('обновляет существующий чат, не меняя его позицию', () => {
    const other: Chat = { chatId: '20000000', phone: '', title: 'Пётр' };
    const updated = upsertChat([other, chat], { ...chat, title: 'Иван' });
    expect(updated[1].title).toBe('Иван');
    expect(updated).toHaveLength(2);
  });
});

describe('sortChatsByLastMessage', () => {
  const older: Chat = { chatId: '1', phone: '', title: 'Старый' };
  const newer: Chat = { chatId: '2', phone: '', title: 'Новый' };
  const silent: Chat = { chatId: '3', phone: '', title: 'Без сообщений' };

  const message = (timestamp: number): Message => ({
    id: String(timestamp),
    text: 'т',
    direction: 'incoming',
    timestamp,
  });

  it('поднимает чаты со свежими сообщениями наверх', () => {
    const sorted = sortChatsByLastMessage([older, newer], {
      1: message(100),
      2: message(200),
    });
    expect(sorted.map((chat) => chat.chatId)).toEqual(['2', '1']);
  });

  it('оставляет чаты без сообщений внизу в исходном порядке', () => {
    const sorted = sortChatsByLastMessage([silent, older, newer], {
      1: message(100),
      2: message(200),
    });
    expect(sorted.map((chat) => chat.chatId)).toEqual(['2', '1', '3']);
  });
});

describe('groupMessagesByChat', () => {
  it('раскладывает журналы по чатам и сортирует по времени', () => {
    const grouped = groupMessagesByChat([
      { type: 'incoming', idMessage: '2', timestamp: 200, typeMessage: 'textMessage', textMessage: 'позже', chatId: 'a' },
      { type: 'outgoing', idMessage: '1', timestamp: 100, typeMessage: 'textMessage', textMessage: 'раньше', chatId: 'a' },
      { type: 'incoming', idMessage: '3', timestamp: 300, typeMessage: 'textMessage', textMessage: 'другой чат', chatId: 'b' },
      { type: 'incoming', idMessage: '4', timestamp: 400, typeMessage: 'imageMessage', chatId: 'c' },
    ]);

    expect(Object.keys(grouped).sort()).toEqual(['a', 'b']);
    expect(grouped.a.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('пропускает сообщения без chatId', () => {
    expect(groupMessagesByChat([
      { type: 'incoming', idMessage: '1', timestamp: 1, typeMessage: 'textMessage', textMessage: 'т' },
    ])).toEqual({});
  });
});

describe('mergeMessages', () => {
  const message = (id: string, timestamp: number): Message => ({
    id,
    text: id,
    direction: 'incoming',
    timestamp,
  });

  it('объединяет без дублей и сортирует по времени', () => {
    const merged = mergeMessages(
      [message('1', 100), message('3', 300)],
      [message('2', 200), message('3', 300)],
    );
    expect(merged.map((item) => item.id)).toEqual(['1', '2', '3']);
  });
});
