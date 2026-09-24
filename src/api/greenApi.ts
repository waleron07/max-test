import { GreenApiError } from './errors';
import type {
  Credentials,
  DeleteNotificationResponse,
  GetStateInstanceResponse,
  Notification,
  SendMessageRequest,
  SendMessageResponse,
} from '../types/greenApi';

export const DEFAULT_API_URL = 'https://api.green-api.com';

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

export function createGreenApiClient({ idInstance, apiTokenInstance, apiUrl }: Credentials) {
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
      const data = await request<Notification>({
        method: 'GET',
        apiMethod: 'receiveNotification',
        query: { receiveTimeout: RECEIVE_TIMEOUT_SECONDS },
        signal,
      });
      return data?.body ? data : null;
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
