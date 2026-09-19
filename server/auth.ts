import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Request } from 'express';
import type { Store } from './db';
import type { User } from './types';
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password: string, value: string) {
  const [salt, hash] = value.split(':');
  const expected = Buffer.from(hash, 'hex');
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function findUser(store: Store, email: string): User | undefined {
  const account = store.db
    .prepare('SELECT user_id FROM accounts WHERE email=?')
    .get(email.toLowerCase()) as { user_id: string } | undefined;
  if (!account) return;
  const row = store.db
    .prepare("SELECT data FROM records WHERE kind='users' AND id=?")
    .get(account.user_id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function createUser(store: Store, user: User) {
  store.db
    .prepare('INSERT INTO accounts(email,user_id) VALUES(?,?)')
    .run(user.email.toLowerCase(), user.id);
  store.put('users', user);
  return user;
}
export function sessionUser(store: Store, req: Request): User | undefined {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('continuum_session='));
  if (!cookie) return;
  const token = cookie.slice('continuum_session='.length);
  const row = store.db
    .prepare(
      "SELECT r.data FROM sessions s JOIN records r ON r.id=s.user_id WHERE s.token=? AND s.expires>? AND r.kind='users'",
    )
    .get(digest(token), Date.now()) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function newSession(store: Store, user: User, remember = false) {
  const token = randomBytes(32).toString('hex');
  const age = (remember ? 30 : 1) * 86400000;
  store.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  store.db
    .prepare('INSERT INTO sessions VALUES(?,?,?)')
    .run(digest(token), user.id, Date.now() + age);
  return { token, age };
}
export function publicUser(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}
