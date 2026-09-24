import type { Credentials } from '../types/greenApi';

const STORAGE_KEY = 'green-api-max-chat:credentials';

/**
 * sessionStorage, а не localStorage: данные живут только до закрытия вкладки
 * и не остаются на диске после работы с чужого компьютера.
 */
export function loadCredentials(): Credentials | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null
      && 'idInstance' in parsed && typeof parsed.idInstance === 'string'
      && 'apiTokenInstance' in parsed && typeof parsed.apiTokenInstance === 'string'
    ) {
      return {
        idInstance: parsed.idInstance,
        apiTokenInstance: parsed.apiTokenInstance,
        apiUrl: 'apiUrl' in parsed && typeof parsed.apiUrl === 'string' ? parsed.apiUrl : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: Credentials): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Приватный режим или переполненное хранилище — подключение всё равно работает.
  }
}

export function clearCredentials(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // см. saveCredentials
  }
}
