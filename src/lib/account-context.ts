import { AsyncLocalStorage } from 'node:async_hooks';
import type { SupabaseClient } from '@supabase/supabase-js';

type AccountContext = { userId: string; database: SupabaseClient };
const context = new AsyncLocalStorage<AccountContext>();
const accounts = new Map<string, { touched: number; resources: Map<string, unknown> }>();

export function runWithAccount<T>(account: AccountContext, work: () => T): T { return context.run(account, work); }
export function currentAccount() {
  const value = context.getStore();
  if (!value) throw new Error('An authenticated account is required.');
  return value;
}
export function accountResource<T>(key: string, create: () => T): T {
  const { userId } = currentAccount();
  let account = accounts.get(userId);
  if (!account || Date.now() - account.touched > 1_800_000) {
    account = { touched: Date.now(), resources: new Map() };
    accounts.delete(userId);
    accounts.set(userId, account);
    if (accounts.size > 128) accounts.delete(accounts.keys().next().value!);
  }
  account.touched = Date.now();
  if (!account.resources.has(key)) account.resources.set(key, create());
  return account.resources.get(key) as T;
}
