/**
 * Типы описывают только те части GREEN-API (MAX), которые реально используются приложением.
 * Документация: https://green-api.com/v3/docs/api/
 */

export type Credentials = {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
};

/** https://green-api.com/v3/docs/api/account/GetStateInstance/ */
export type InstanceState =
  | 'notAuthorized'
  | 'authorized'
  | 'blocked'
  | 'starting'
  | 'suspended'
  | 'pendingPassword';

export type GetStateInstanceResponse = {
  stateInstance: InstanceState;
};

/** https://green-api.com/v3/docs/api/sending/SendMessage/ */
export type SendMessageRequest = {
  chatId: string;
  message: string;
  quotedMessageId?: string;
};

export type SendMessageResponse = {
  idMessage: string;
};

/** https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/ */
export type DeleteNotificationResponse = {
  result: boolean;
  reason?: string;
};

export type WebhookType =
  | 'incomingMessageReceived'
  | 'outgoingMessageReceived'
  | 'outgoingAPIMessageReceived'
  | 'outgoingMessageStatus'
  | 'stateInstanceChanged'
  | 'quotaExceeded';

export type SenderData = {
  chatId: string;
  chatName?: string;
  chatType?: string;
  sender?: string;
  senderName?: string;
  senderType?: string;
  senderContactName?: string;
  /** Приходит числом, поэтому сравнивать с номером телефона нужно после нормализации. */
  senderPhoneNumber?: number | string;
};

export type TextMessageData = {
  textMessage: string;
};

export type MessageData = {
  typeMessage: string;
  textMessageData?: TextMessageData;
};

/**
 * Тело уведомления. Поля senderData/messageData есть только у сообщений,
 * поэтому они опциональны — иначе типы врут про stateInstanceChanged и quotaExceeded.
 */
export type NotificationBody = {
  typeWebhook: WebhookType | string;
  timestamp?: number;
  idMessage?: string;
  senderData?: SenderData;
  messageData?: MessageData;
  stateInstance?: InstanceState;
};

/** https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/ */
export type Notification = {
  receiptId: number;
  body: NotificationBody;
};
