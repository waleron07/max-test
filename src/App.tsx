import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { candidateApiUrls, createGreenApiClient } from './api/greenApi';
import { toUserMessage } from './api/errors';
import { Chat } from './components/Chat/Chat';
import { ChatList } from './components/ChatList/ChatList';
import { CredentialsForm } from './components/CredentialsForm/CredentialsForm';
import { NewChatForm } from './components/NewChatForm/NewChatForm';
import { Alert } from './components/ui/Alert';
import { useReceiveNotifications } from './hooks/useReceiveNotifications';
import type { Chat as ChatModel, Message } from './types/chat';
import type { Credentials, NotificationBody } from './types/greenApi';
import {
  appendMessage,
  chatFromNotification,
  historyToMessages,
  sortChatsByLastMessage,
  toChat,
  upsertChat,
} from './utils/chats';
import { clearCredentials, loadCredentials, saveCredentials } from './utils/credentialsStorage';
import { belongsToChat, toMessage, toStatusUpdate } from './utils/notifications';
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
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null);

  const [chats, setChats] = useState<ChatModel[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [loadedHistories, setLoadedHistories] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});

  const [loadingHistoryFor, setLoadingHistoryFor] = useState<string | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [openChatError, setOpenChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Клиент пересоздаётся только при смене учётных данных — от него зависит цикл опроса.
  const client = useMemo(
    () => (credentials ? createGreenApiClient(credentials) : null),
    [credentials],
  );

  const activeChat = chats.find((chat) => chat.chatId === activeChatId) ?? null;
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const handleNotification = useCallback(
    (body: NotificationBody) => {
      const statusUpdate = toStatusUpdate(body);
      if (statusUpdate) {
        // Статус ищем по idMessage во всех чатах: chatId уведомления может отличаться от ключа.
        setMessagesByChat((prev) => Object.fromEntries(
          Object.entries(prev).map(([chatId, messages]) => [
            chatId,
            messages.map((item) =>
              item.id === statusUpdate.idMessage ? { ...item, status: statusUpdate.status } : item,
            ),
          ]),
        ));
        return;
      }

      const message = toMessage(body);
      if (!message) {
        return;
      }

      // Сообщение не теряется, даже если чата ещё нет в списке: он создаётся из уведомления.
      const known = chats.find((chat) => belongsToChat(body, chat));
      const chat = known ?? chatFromNotification(body);
      if (!chat) {
        return;
      }

      if (!known) {
        setChats((prev) => upsertChat(prev, chat));
      }
      setMessagesByChat((prev) => ({
        ...prev,
        [chat.chatId]: appendMessage(prev[chat.chatId] ?? [], message),
      }));
      if (message.direction === 'incoming' && chat.chatId !== activeChatIdRef.current) {
        setUnread((prev) => ({ ...prev, [chat.chatId]: (prev[chat.chatId] ?? 0) + 1 }));
      }
    },
    [chats],
  );

  const { error: receiveError } = useReceiveNotifications(client, handleNotification);

  // Учётные данные из сессии вкладки: переживают перезагрузку страницы, но не её закрытие.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;
    const stored = loadCredentials();
    if (stored) {
      void handleConnect(stored);
    }
  }, []);

  async function handleConnect(next: Credentials) {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const { credentials: resolved, stateInstance } = await connectToInstance(next);
      if (stateInstance !== 'authorized') {
        clearCredentials();
        setConnectionError(STATE_MESSAGES[stateInstance] ?? `Состояние инстанса: ${stateInstance}`);
        return;
      }
      setCredentials(resolved);
      saveCredentials(resolved);
      void checkReceivingSettings(resolved);
      void loadChats(resolved);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Не удалось подключиться к GREEN-API', error);
      }
      clearCredentials();
      setConnectionError(toUserMessage(error));
    } finally {
      setIsConnecting(false);
    }
  }

  /** Подбирает хост инстанса: сначала выделенный, затем универсальный. */
  async function connectToInstance(next: Credentials) {
    const hosts = next.apiUrl ? [next.apiUrl] : candidateApiUrls(next.idInstance);
    let lastError: unknown;

    for (const apiUrl of hosts) {
      const credentials = { ...next, apiUrl };
      try {
        const { stateInstance } = await createGreenApiClient(credentials).getStateInstance();
        return { credentials, stateInstance };
      } catch (error) {
        lastError = error;
        if (import.meta.env.DEV) {
          console.warn(`Хост ${apiUrl} не ответил`, error);
        }
      }
    }

    throw lastError;
  }

  /**
   * Уведомления попадают в очередь HTTP API только при пустом webhookUrl.
   * Если инстанс настроен на вебхуки, входящие не придут — предупреждаем сразу.
   */
  async function checkReceivingSettings(next: Credentials) {
    try {
      const settings = await createGreenApiClient(next).getSettings();
      if (settings?.webhookUrl) {
        setSettingsWarning(
          'У инстанса задан webhookUrl — уведомления уходят на него, а не в очередь HTTP API. '
          + 'Очистите поле webhookUrl в личном кабинете GREEN-API, иначе входящие сообщения не появятся.',
        );
      } else if (settings?.incomingWebhook === 'no') {
        setSettingsWarning(
          'В настройках инстанса отключены уведомления о входящих сообщениях. '
          + 'Включите «Входящие сообщения» в личном кабинете GREEN-API.',
        );
      } else if (settings?.outgoingWebhook === 'no') {
        setSettingsWarning(
          'Статусы доставки (✓✓) не придут: в настройках инстанса отключены уведомления '
          + 'о статусах отправленных сообщений. Включите «Статус отправленного сообщения» '
          + 'в личном кабинете GREEN-API.',
        );
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Не удалось прочитать настройки инстанса', error);
      }
    }
  }

  async function loadChats(next: Credentials) {
    setIsLoadingChats(true);
    try {
      const summaries = await createGreenApiClient(next).getChats();
      const loaded = summaries.map(toChat).filter((chat): chat is ChatModel => chat !== null);
      setChats((prev) => loaded.reduce(upsertChat, prev));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Не удалось загрузить список чатов', error);
      }
    } finally {
      setIsLoadingChats(false);
    }
  }

  function handleDisconnect() {
    clearCredentials();
    setCredentials(null);
    setSettingsWarning(null);
    setChats([]);
    setActiveChatId(null);
    setMessagesByChat({});
    setLoadedHistories({});
    setUnread({});
    setChatError(null);
    setOpenChatError(null);
  }

  function handleSelectChat(chat: ChatModel) {
    setActiveChatId(chat.chatId);
    setChatError(null);
    setUnread((prev) => ({ ...prev, [chat.chatId]: 0 }));
  }

  /** История подгружается один раз на чат: дальше список пополняют уведомления. */
  async function loadHistory(chatId: string, force = false) {
    if (!client || (!force && loadedHistories[chatId])) {
      return;
    }
    setLoadingHistoryFor(chatId);
    try {
      const history = await client.getChatHistory(chatId);
      const messages = historyToMessages(history);
      if (import.meta.env.DEV) {
        console.log(`История ${chatId}: получено ${history.length}, текстовых ${messages.length}`);
      }
      setLoadedHistories((prev) => ({ ...prev, [chatId]: true }));
      setMessagesByChat((prev) => ({
        ...prev,
        // Уведомления могли прийти раньше ответа — их сохраняем поверх истории.
        [chatId]: (prev[chatId] ?? []).reduce(appendMessage, messages),
      }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Не удалось загрузить историю сообщений', error);
      }
      setChatError('Не удалось загрузить историю сообщений.');
    } finally {
      setLoadingHistoryFor((prev) => (prev === chatId ? null : prev));
    }
  }

  // Эффект, а не вызов из обработчика: история грузится при любом способе открытия чата.
  useEffect(() => {
    if (client && activeChatId && !loadedHistories[activeChatId]) {
      void loadHistory(activeChatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, activeChatId, loadedHistories]);

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
      const existing = chats.find((chat) => chat.chatId === chatId);
      const chat = existing ?? { chatId, phone, title: formatPhone(phone) };
      if (!existing) {
        setChats((prev) => upsertChat(prev, chat));
        void loadContactName(chat);
      }
      handleSelectChat(chat);
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

  async function loadContactName(chat: ChatModel) {
    if (!client) {
      return;
    }
    try {
      const info = await client.getContactInfo(chat.chatId);
      const name = info?.contactName || info?.name;
      if (name) {
        setChats((prev) => upsertChat(prev, { ...chat, title: name }));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Не удалось получить имя контакта', error);
      }
    }
  }

  async function handleSend(text: string) {
    if (!client || !activeChat || isSending) {
      return;
    }

    const chatId = activeChat.chatId;
    const pendingId = `pending-${crypto.randomUUID()}`;
    setIsSending(true);
    setChatError(null);
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: appendMessage(prev[chatId] ?? [], {
        id: pendingId,
        text,
        direction: 'outgoing',
        timestamp: Math.floor(Date.now() / 1000),
        status: 'sending',
      }),
    }));

    try {
      const { idMessage } = await client.sendMessage({ chatId, message: text });
      setMessagesByChat((prev) => {
        const messages = prev[chatId] ?? [];
        return {
          ...prev,
          // Уведомление об этом же сообщении могло прийти раньше ответа — тогда убираем черновик.
          [chatId]: messages.some((item) => item.id === idMessage)
            ? messages.filter((item) => item.id !== pendingId)
            : messages.map((item) =>
                item.id === pendingId ? { ...item, id: idMessage, status: 'sent' } : item,
              ),
        };
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Не удалось отправить сообщение', error);
      }
      setChatError(toUserMessage(error));
      setMessagesByChat((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map((item) =>
          item.id === pendingId ? { ...item, status: 'failed' } : item,
        ),
      }));
    } finally {
      setIsSending(false);
    }
  }

  const lastMessages = useMemo(() => {
    const result: Record<string, Message | undefined> = {};
    for (const [chatId, messages] of Object.entries(messagesByChat)) {
      result[chatId] = messages[messages.length - 1];
    }
    return result;
  }, [messagesByChat]);

  const sortedChats = useMemo(
    () => sortChatsByLastMessage(chats, lastMessages),
    [chats, lastMessages],
  );

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

        {settingsWarning && (
          <div className={styles.topError}>
            <Alert>{settingsWarning}</Alert>
          </div>
        )}

        {receiveError && (
          <div className={styles.topError}>
            <Alert>{receiveError}</Alert>
          </div>
        )}

        <div className={styles.body} data-chat-open={activeChat ? 'true' : 'false'}>
          <aside className={styles.sidebar}>
            <NewChatForm
              onOpenChat={handleOpenChat}
              isOpening={isOpeningChat}
              error={openChatError}
              onEdit={() => setOpenChatError(null)}
            />
            <ChatList
              chats={sortedChats}
              activeChatId={activeChatId}
              lastMessages={lastMessages}
              unread={unread}
              isLoading={isLoadingChats}
              onSelect={handleSelectChat}
            />
          </aside>

          {activeChat ? (
            <Chat
              chat={activeChat}
              messages={messagesByChat[activeChat.chatId] ?? []}
              isLoadingHistory={loadingHistoryFor === activeChat.chatId}
              isSending={isSending}
              isListening={!receiveError}
              error={chatError}
              onSend={handleSend}
              onBack={() => setActiveChatId(null)}
              onRefresh={() => void loadHistory(activeChat.chatId, true)}
            />
          ) : (
            <div className={styles.placeholder}>
              <p>Выберите чат или начните новый по номеру телефона</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
