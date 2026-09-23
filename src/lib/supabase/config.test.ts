import { expect, test } from 'vitest';
import { readSupabaseConfig } from './config';
test('configuration rejects missing values, insecure URLs and secret keys', () => {
  expect(readSupabaseConfig()).toBeNull();
  expect(readSupabaseConfig('https://demo.supabase.co', 'sb_secret_example')).toBeNull();
  expect(readSupabaseConfig('http://demo.supabase.co', 'sb_publishable_example')).toBeNull();
  expect(readSupabaseConfig('https://demo.supabase.co/path', 'sb_publishable_example')).toBeNull();
  expect(readSupabaseConfig('https://demo.supabase.co', 'sb_publishable_example')).toEqual({ url:'https://demo.supabase.co', key:'sb_publishable_example' });
});
