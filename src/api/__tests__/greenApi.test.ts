import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_URL, candidateApiUrls, createGreenApiClient } from '../greenApi';
import { GreenApiError } from '../errors';

const credentials = { idInstance: '710722745991', apiTokenInstance: 'token' };

function mockFetch(status: number, body: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('candidateApiUrls', () => {
  it('сначала пробует выделенный хост инстанса', () => {
    expect(candidateApiUrls('710722745991')).toEqual([
      'https://7107.api.greenapi.com',
      DEFAULT_API_URL,
    ]);
  });

  it('для нечислового идентификатора остаётся универсальный хост', () => {
    expect(candidateApiUrls('abc')).toEqual([DEFAULT_API_URL]);
  });
});

describe('receiveNotification', () => {
  it('считает 408 пустой очередью, а не ошибкой', async () => {
    mockFetch(408, '');
    await expect(createGreenApiClient(credentials).receiveNotification()).resolves.toBeNull();
  });

  it('возвращает null на пустое тело ответа', async () => {
    mockFetch(200, '');
    await expect(createGreenApiClient(credentials).receiveNotification()).resolves.toBeNull();
  });

  it('отдаёт уведомление вместе с receiptId', async () => {
    mockFetch(200, JSON.stringify({
      receiptId: 1234567,
      body: { typeWebhook: 'incomingMessageReceived' },
    }));
    const notification = await createGreenApiClient(credentials).receiveNotification();
    expect(notification?.receiptId).toBe(1234567);
  });

  it('пробрасывает остальные ошибки', async () => {
    mockFetch(401, '');
    await expect(createGreenApiClient(credentials).receiveNotification())
      .rejects.toBeInstanceOf(GreenApiError);
  });
});

describe('deleteNotification', () => {
  it('ставит receiptId после токена, как требует документация', async () => {
    const fetchMock = mockFetch(200, JSON.stringify({ result: true }));
    await createGreenApiClient(credentials).deleteNotification(1234567);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.green-api.com/waInstance710722745991/deleteNotification/token/1234567',
    );
  });
});
