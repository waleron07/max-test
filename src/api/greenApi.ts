import { GreenApiError } from './errors';
import type {
  ChatSummary,
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  GetContactInfoResponse,
  GetSettingsResponse,
  GetStateInstanceResponse,
  HistoryMessage,
  Notification,
  SendMessageRequest,
  SendMessageResponse,
} from '../types/greenApi';

/** Универсальный хост GREEN-API: подходит инстансам, у которых нет выделенного сервера. */
export const DEFAULT_API_URL = 'https://api.green-api.com';

/**
 * Инстансы на выделенных серверах отвечают только на своём хосте вида `https://7107.api.greenapi.com`
 * (адрес указан в личном кабинете). Префикс — первые четыре цифры idInstance, поэтому хост можно
 * определить автоматически и не спрашивать его у пользователя: задание требует только idInstance и токен.
 */
export function candidateApiUrls(idInstance: string): string[] {
  const override = import.meta.env.VITE_GREEN_API_URL;
  if (override) {
    return [override];
  }
  const prefix = idInstance.trim().slice(0, 4);
  return /^\d{4}$/.test(prefix)
    ? [`https://${prefix}.api.greenapi.com`, DEFAULT_API_URL]
    : [DEFAULT_API_URL];
}

/** receiveNotification принимает 5–60 секунд; берём длинный таймаут, чтобы это был long polling. */
const RECEIVE_TIMEOUT_SECONDS = 20;

type RequestOptions = {
  method: 'GET' | 'POST' | 'DELETE';
  /** Имя метода GREEN-API, например `sendMessage`. */
  apiMethod: string;
  /** Сегменты пути после apiTokenInstance, как того требует deleteNotification. */
  pathParams?: (string | number)[];
  query?: Record<string, string | number>;
  body?: unknown;
  signal?: AbortSignal;
};

export type GreenApiClient = ReturnType<typeof createGreenApiClient>;

export function createGreenApiClient({
  idInstance,
  apiTokenInstance,
  apiUrl = DEFAULT_API_URL,
}: Credentials) {
  const base = `${apiUrl.replace(/\/+$/, '')}/waInstance${idInstance}`;

  function buildUrl({ apiMethod, pathParams = [], query }: RequestOptions): string {
    const path = [base, apiMethod, apiTokenInstance, ...pathParams].join('/');
    const search = query ? new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return search ? `${path}?${search}` : path;
  }

  async function request<T>(options: RequestOptions): Promise<T | null> {
    const { method, body, signal } = options;
    const response = await fetch(buildUrl(options), {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new GreenApiError(`GREEN-API вернул ошибку ${response.status}`, response.status);
    }

    // receiveNotification при пустой очереди отвечает пустым телом или `null`.
    if (!raw.trim() || raw.trim() === 'null') {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new GreenApiError('GREEN-API вернул ответ в неизвестном формате.');
    }
  }

  return {
    /** https://green-api.com/v3/docs/api/account/GetStateInstance/ */
    async getStateInstance(signal?: AbortSignal): Promise<GetStateInstanceResponse> {
      const data = await request<GetStateInstanceResponse>({
        method: 'GET',
        apiMethod: 'getStateInstance',
        signal,
      });
      if (!data?.stateInstance) {
        throw new GreenApiError('GREEN-API не вернул состояние инстанса.');
      }
      return data;
    },

    /** https://green-api.com/v3/docs/api/service/GetChats/ */
    async getChats(signal?: AbortSignal): Promise<ChatSummary[]> {
      const data = await request<ChatSummary[]>({ method: 'GET', apiMethod: 'getChats', signal });
      return Array.isArray(data) ? data : [];
    },

    /** https://green-api.com/v3/docs/api/journals/GetChatHistory/ */
    async getChatHistory(chatId: string, count = 50, signal?: AbortSignal): Promise<HistoryMessage[]> {
      const data = await request<HistoryMessage[]>({
        method: 'POST',
        apiMethod: 'getChatHistory',
        body: { chatId, count },
        signal,
      });
      return Array.isArray(data) ? data : [];
    },

    /**
     * https://green-api.com/v3/docs/api/journals/LastIncomingMessages/
     * https://green-api.com/v3/docs/api/journals/LastOutgoingMessages/
     * Дают последние сообщения сразу по всем чатам — из них строится сортировка списка и превью.
     */
    async lastMessages(minutes: number, signal?: AbortSignal): Promise<HistoryMessage[]> {
      const [incoming, outgoing] = await Promise.all([
        request<HistoryMessage[]>({
          method: 'GET',
          apiMethod: 'lastIncomingMessages',
          query: { minutes },
          signal,
        }),
        request<HistoryMessage[]>({
          method: 'GET',
          apiMethod: 'lastOutgoingMessages',
          query: { minutes },
          signal,
        }),
      ]);
      return [...(incoming ?? []), ...(outgoing ?? [])];
    },

    /** https://green-api.com/v3/docs/api/account/GetSettings/ */
    async getSettings(signal?: AbortSignal): Promise<GetSettingsResponse | null> {
      return request<GetSettingsResponse>({ method: 'GET', apiMethod: 'getSettings', signal });
    },

    /** https://green-api.com/v3/docs/api/service/CheckAccount/ */
    async checkAccount(phone: string, signal?: AbortSignal): Promise<CheckAccountResponse | null> {
      return request<CheckAccountResponse>({
        method: 'POST',
        apiMethod: 'checkAccount',
        body: { phoneNumber: Number(phone) },
        signal,
      });
    },

    /** https://green-api.com/v3/docs/api/service/GetContactInfo/ */
    async getContactInfo(chatId: string, signal?: AbortSignal): Promise<GetContactInfoResponse | null> {
      return request<GetContactInfoResponse>({
        method: 'POST',
        apiMethod: 'getContactInfo',
        body: { chatId },
        signal,
      });
    },

    /** https://green-api.com/v3/docs/api/sending/SendMessage/ */
    async sendMessage(
      payload: SendMessageRequest,
      signal?: AbortSignal,
    ): Promise<SendMessageResponse> {
      const data = await request<SendMessageResponse>({
        method: 'POST',
        apiMethod: 'sendMessage',
        body: payload,
        signal,
      });
      if (!data?.idMessage) {
        throw new GreenApiError('GREEN-API не вернул идентификатор сообщения.');
      }
      return data;
    },

    /**
     * https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/
     * Запрос висит до receiveTimeout секунд и возвращает null, если очередь пуста.
     */
    async receiveNotification(signal?: AbortSignal): Promise<Notification | null> {
      try {
        const data = await request<Notification>({
          method: 'GET',
          apiMethod: 'receiveNotification',
          query: { receiveTimeout: RECEIVE_TIMEOUT_SECONDS },
          signal,
        });
        return data?.body ? data : null;
      } catch (error) {
        // Истёкшее ожидание приходит как 408 с пустым телом: очередь пуста, это не ошибка.
        if (error instanceof GreenApiError && error.status === 408) {
          return null;
        }
        throw error;
      }
    },

    /** https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/ */
    async deleteNotification(
      receiptId: number,
      signal?: AbortSignal,
    ): Promise<DeleteNotificationResponse> {
      const data = await request<DeleteNotificationResponse>({
        method: 'DELETE',
        apiMethod: 'deleteNotification',
        pathParams: [receiptId],
        signal,
      });
      return data ?? { result: false, reason: 'Пустой ответ deleteNotification' };
    },
  };
}
