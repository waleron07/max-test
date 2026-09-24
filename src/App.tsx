import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGreenApiClient } from './api/greenApi';
import { toUserMessage } from './api/errors';
import { Chat } from './components/Chat/Chat';
import { CredentialsForm } from './components/CredentialsForm/CredentialsForm';
import { NewChatForm } from './components/NewChatForm/NewChatForm';
import { Alert } from './components/ui/Alert';
import { useReceiveNotifications } from './hooks/useReceiveNotifications';
import type { Chat as ChatModel, Message } from './types/chat';
import type { Credentials, NotificationBody } from './types/greenApi';
import { belongsToChat, toMessage } from './utils/notifications';
import { buildChatId, canCheckAccount, formatPhone } from './utils/phone';
import styles from './App.module.css';

const STATE_MESSAGES: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован в MAX. Авторизуйте его в личном кабинете GREEN-API.',
  blocked: 'Аккаунт заблокирован.',
  starting: 'Инстанс запускается, попробуйте через минуту.',
  suspended: 'Аккаунт временно ограничен в отправке сообщений.',
  pendingPassword: 'Требуется двухфакторная авторизация инстанса.',
};

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatModel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Ответ sendMessage может прийти уже после закрытия или смены чата — тогда его нельзя применять.
  const chatRef = useRef(chat);
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [openChatError, setOpenChatError] = useState<string | null>(null);

  // Клиент пересоздаётся только при смене учётных данных — от него зависит цикл polling.
  const client = useMemo(
    () => (credentials ? createGreenApiClient(credentials) : null),
    [credentials],
  );

  const handleNotification = useCallback(
    (body: NotificationBody) => {
      if (!chat || !belongsToChat(body, chat)) {
        return;
      }
      const message = toMessage(body);
      if (!message) {
        return;
      }
      // Исходящее сообщение уже добавлено оптимистично — сверяем по idMessage.
      setMessages((prev) =>
        prev.some((item) => item.id === message.id)
          ? prev.map((item) => (item.id === message.id ? { ...item, status: 'sent' } : item))
          : [...prev, message],
      );
    },
    [chat],
  );

  const { error: receiveError } = useReceiveNotifications(client, handleNotification);

  async function handleConnect(next: Credentials) {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const { stateInstance } = await createGreenApiClient(next).getStateInstance();
      if (stateInstance !== 'authorized') {
        setConnectionError(STATE_MESSAGES[stateInstance] ?? `Состояние инстанса: ${stateInstance}`);
        return;
      }
      setCredentials(next);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Не удалось подключиться к GREEN-API', error);
      }
      setConnectionError(toUserMessage(error));
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    setCredentials(null);
    setChat(null);
    setMessages([]);
    setChatError(null);
  }

  async function handleOpenChat(phone: string) {
    if (!client || isOpeningChat) {
      return;
    }

    setIsOpeningChat(true);
    setOpenChatError(null);

    try {
      const chatId = await resolveChatId(phone);
      if (!chatId) {
        setOpenChatError('Этот номер не зарегистрирован в MAX.');
        return;
      }
      setChat({ chatId, phone, title: formatPhone(phone) });
      setMessages([]);
      setChatError(null);
      void loadContactName(phone, chatId);
    } finally {
      setIsOpeningChat(false);
    }
  }

  /**
   * Возвращает канонический числовой chatId (по нему точно совпадают входящие уведомления)
   * или null, если аккаунта в MAX нет. Если проверка недоступна, работаем по `<phone>@c.us`.
   */
  async function resolveChatId(phone: string): Promise<string | null> {
    const fallback = buildChatId(phone);
    if (!client || !canCheckAccount(phone)) {
      return fallback;
    }

    try {
      const result = await client.checkAccount(phone);
      if (!result || !('exist' in result)) {
        return fallback;
      }
      return result.exist ? result.chatId || fallback : null;
    } catch (error) {
      // Сбой проверки не должен мешать открыть чат: номер мог быть верным.
      if (import.meta.env.DEV) {
        console.warn('Не удалось проверить номер через checkAccount', error);
      }
      return fallback;
    }
  }

  async function loadContactName(phone: string, chatId: string) {
    if (!client) {
      return;
    }
    try {
      const info = await client.getContactInfo(chatId);
      const name = info?.contactName || info?.name;
      if (name && chatRef.current?.phone === phone) {
        setChat((prev) => (prev?.phone === phone ? { ...prev, title: name } : prev));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Не удалось получить имя контакта', error);
      }
    }
  }

  async function handleSend(text: string) {
    if (!client || !chat || isSending) {
      return;
    }

    setIsSending(true);
    setChatError(null);

    const targetChatId = chat.chatId;
    const pendingId = `pending-${crypto.randomUUID()}`;
    const pending: Message = {
      id: pendingId,
      text,
      direction: 'outgoing',
      timestamp: Math.floor(Date.now() / 1000),
      status: 'sending',
    };
    setMessages((prev) => [...prev, pending]);

    try {
      const { idMessage } = await client.sendMessage({ chatId: targetChatId, message: text });
      if (chatRef.current?.chatId !== targetChatId) {
        return;
      }
      setMessages((prev) =>
        // Уведомление об этом же сообщении могло прийти раньше ответа — тогда убираем черновик.
        prev.some((item) => item.id === idMessage)
          ? prev.filter((item) => item.id !== pendingId)
          : prev.map((item) =>
              item.id === pendingId ? { ...item, id: idMessage, status: 'sent' } : item,
            ),
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Не удалось отправить сообщение', error);
      }
      if (chatRef.current?.chatId !== targetChatId) {
        return;
      }
      setChatError(toUserMessage(error));
      setMessages((prev) =>
        prev.map((item) => (item.id === pendingId ? { ...item, status: 'failed' } : item)),
      );
    } finally {
      setIsSending(false);
    }
  }

  if (!credentials) {
    return (
      <main className={styles.centered}>
        <CredentialsForm
          onConnect={handleConnect}
          isConnecting={isConnecting}
          error={connectionError}
        />
      </main>
    );
  }

  return (
    <main className={styles.app}>
      <div className={styles.window}>
        <div className={styles.topbar}>
          <span className={styles.connection}>
            <span className={styles.dot} aria-hidden="true" />
            Инстанс {credentials.idInstance} подключён
          </span>
          <button className={styles.disconnect} type="button" onClick={handleDisconnect}>
            Отключиться
          </button>
        </div>

        {receiveError && (
          <div className={styles.topError}>
            <Alert>{receiveError}</Alert>
          </div>
        )}

        {chat ? (
          <Chat
            chat={chat}
            messages={messages}
            isSending={isSending}
            isListening={!receiveError}
            error={chatError}
            onSend={handleSend}
            onClose={() => setChat(null)}
          />
        ) : (
          <>
            <NewChatForm
              onOpenChat={handleOpenChat}
              isOpening={isOpeningChat}
              error={openChatError}
              onEdit={() => setOpenChatError(null)}
            />
            <div className={styles.placeholder}>
              <p>Откройте чат по номеру телефона, чтобы начать переписку в MAX</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
