import { describe, expect, it } from 'vitest';
import { belongsToChat, toMessage, toStatusUpdate } from '../notifications';
import type { NotificationBody } from '../../types/greenApi';
import type { Chat } from '../../types/chat';

const chat: Chat = { chatId: '79991234567@c.us', phone: '79991234567', title: '+79991234567' };

const incomingText: NotificationBody = {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    chatName: 'Иван',
    sender: '10000000',
    senderName: 'Иван',
    senderContactName: 'Иван Контакт',
    senderPhoneNumber: 79991234567,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет!' },
  },
};

describe('toMessage', () => {
  it('преобразует входящее текстовое сообщение', () => {
    expect(toMessage(incomingText)).toEqual({
      id: '1763115112345',
      text: 'Привет!',
      direction: 'incoming',
      timestamp: 1763115112,
      senderName: 'Иван Контакт',
    });
  });

  it('помечает отправленное через API сообщение как исходящее', () => {
    const message = toMessage({ ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' });
    expect(message?.direction).toBe('outgoing');
    expect(message?.senderName).toBeUndefined();
  });

  it('игнорирует служебные уведомления', () => {
    expect(toMessage({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' })).toBeNull();
    expect(toMessage({ typeWebhook: 'outgoingMessageStatus', idMessage: '1' })).toBeNull();
  });

  it('читает сообщение со ссылкой из extendedTextMessageData', () => {
    expect(toMessage({
      ...incomingText,
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'https://green-api.com' },
      },
    })?.text).toBe('https://green-api.com');
  });

  it('игнорирует нетекстовые сообщения', () => {
    expect(
      toMessage({ ...incomingText, messageData: { typeMessage: 'imageMessage' } }),
    ).toBeNull();
  });

  it('игнорирует сообщение без текста', () => {
    expect(
      toMessage({
        ...incomingText,
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: '' } },
      }),
    ).toBeNull();
  });
});

describe('belongsToChat', () => {
  it('сопоставляет входящее уведомление по номеру отправителя', () => {
    expect(belongsToChat(incomingText, chat)).toBe(true);
  });

  it('сопоставляет уведомление по каноническому chatId, полученному из getContactInfo', () => {
    const resolved = { ...chat, chatId: '10000000' };
    const body = { ...incomingText, senderData: { chatId: '10000000' } };
    expect(belongsToChat(body, resolved)).toBe(true);
  });

  it('сопоставляет уведомление по chatId', () => {
    const body = { ...incomingText, senderData: { chatId: '79991234567@c.us' } };
    expect(belongsToChat(body, chat)).toBe(true);
  });

  it('отсеивает чужой чат', () => {
    const body = {
      ...incomingText,
      senderData: { chatId: '20000000', senderPhoneNumber: 79990000000 },
    };
    expect(belongsToChat(body, chat)).toBe(false);
  });

  it('не сопоставляет исходящее уведомление по номеру отправителя', () => {
    const body = { ...incomingText, typeWebhook: 'outgoingMessageReceived' };
    expect(belongsToChat(body, chat)).toBe(false);
  });
});

describe('toStatusUpdate', () => {
  it('читает статус доставки из уведомления', () => {
    expect(toStatusUpdate({
      typeWebhook: 'outgoingMessageStatus',
      chatId: '10000000',
      idMessage: '115054445839974415',
      status: 'delivered',
    })).toEqual({ idMessage: '115054445839974415', status: 'delivered' });
  });

  it('считает недоставленным сообщение без аккаунта в MAX', () => {
    expect(toStatusUpdate({
      typeWebhook: 'outgoingMessageStatus',
      idMessage: '1',
      status: 'noAccount',
    })?.status).toBe('failed');
  });

  it('игнорирует прочие уведомления и неизвестные статусы', () => {
    expect(toStatusUpdate({ typeWebhook: 'incomingMessageReceived', idMessage: '1' })).toBeNull();
    expect(toStatusUpdate({
      typeWebhook: 'outgoingMessageStatus',
      idMessage: '1',
      status: 'whatever',
    })).toBeNull();
  });
});
