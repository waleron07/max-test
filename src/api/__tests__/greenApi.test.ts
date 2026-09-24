import { describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, candidateApiUrls } from '../greenApi';

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
