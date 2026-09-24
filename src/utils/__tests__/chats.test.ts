import { describe, expect, it } from 'vitest';
import { appendMessage, chatFromNotification, historyToMessages, toChat, upsertChat } from '../chats';
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
