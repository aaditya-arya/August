import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createChunkedSecureStorage, createDraftPersistence } from '@august/shared';

export const secureStorage = createChunkedSecureStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
}, randomUUID);
export const accountDraft = (namespace: string, userId: string) =>
  createDraftPersistence(secureStorage, `august-draft-${namespace}-${userId}`);
