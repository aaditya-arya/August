import type { SupabaseClient } from '@supabase/supabase-js';
import { currentAccount } from './account-context';

// Each request uses its verified user's JWT. Never share a session or service-role
// client across requests. AsyncLocalStorage preserves the account across awaits.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const database = currentAccount().database;
    const value = Reflect.get(database, property);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
