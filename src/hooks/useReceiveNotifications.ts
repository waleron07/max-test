import { useEffect, useRef, useState } from 'react';
import type { GreenApiClient } from '../api/greenApi';
import { toUserMessage } from '../api/errors';
import type { NotificationBody } from '../types/greenApi';

const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });

    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
  });
}

/**
 * Один последовательный цикл long polling на клиента:
 * receiveNotification → обработка → deleteNotification → следующий запрос.
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/
 */
export function useReceiveNotifications(
  client: GreenApiClient | null,
  onNotification: (body: NotificationBody) => void,
) {
  const [error, setError] = useState<string | null>(null);

  // Колбэк меняется на каждом рендере, но перезапускать цикл из-за этого нельзя.
  const handlerRef = useRef(onNotification);
  useEffect(() => {
    handlerRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const activeClient = client;
    const controller = new AbortController();
    const { signal } = controller;
    let failures = 0;

    async function poll() {
      while (!signal.aborted) {
        try {
          const notification = await activeClient.receiveNotification(signal);
          failures = 0;
          setError(null);

          if (!notification) {
            continue;
          }

          if (import.meta.env.DEV) {
            console.debug(
              'Уведомление GREEN-API',
              notification.body.typeWebhook,
              notification.body.senderData?.chatId,
            );
          }

          try {
            handlerRef.current(notification.body);
          } catch (handlerError) {
            if (import.meta.env.DEV) {
              console.error('Не удалось обработать уведомление', handlerError);
            }
          }

          // Уведомление обязательно удаляем, иначе очередь не сдвинется.
          const deleted = await activeClient.deleteNotification(notification.receiptId, signal);
          if (!deleted.result && import.meta.env.DEV) {
            console.warn('deleteNotification вернул false', notification.receiptId, deleted.reason);
          }
        } catch (pollError) {
          if (signal.aborted || isAbortError(pollError)) {
            return;
          }

          failures += 1;
          setError(toUserMessage(pollError));
          if (import.meta.env.DEV) {
            console.error('Ошибка получения уведомлений', pollError);
          }

          // Backoff, чтобы при сетевой ошибке не молотить запросами в цикле.
          await delay(
            Math.min(RETRY_BASE_DELAY_MS * 2 ** (failures - 1), RETRY_MAX_DELAY_MS),
            signal,
          );
        }
      }
    }

    void poll();

    return () => {
      controller.abort();
      setError(null);
    };
  }, [client]);

  return { error };
}
