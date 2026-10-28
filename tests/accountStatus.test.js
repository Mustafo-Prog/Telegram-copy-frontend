import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { accountStatus, canPromoteUser, updateAccountCaches } from '../src/utils/accountStatus.js';
import { canDeleteMessage, canEditMessage } from '../src/utils/messageState.js';
import * as locales from '../src/i18n/locales/account.js';

test('only superadmins see Promote for other ordinary accounts; Premium never grants it', () => {
  const regular = { id: 'target', status: 'user' };
  const owner = { id: 'owner', status: 'superadmin' };
  assert.equal(canPromoteUser(owner, regular), true);
  assert.equal(canPromoteUser(owner, { id: 'legacy' }), true);
  for (const status of ['user', 'admin', undefined, 'unknown']) assert.equal(canPromoteUser({ id: 'actor', status }, regular), false);
  assert.equal(canPromoteUser(owner, owner), false);
  assert.equal(canPromoteUser(owner, { id: 'other', status: 'superadmin' }), false);
  assert.equal(canPromoteUser(owner, { id: 'premium', status: 'admin' }), true);
  assert.equal(canPromoteUser(owner, null), false);
  assert.equal(accountStatus('unknown'), 'user');
});

test('general-chat deletion is available to superadmins while editing and pending-message restrictions stay intact', () => {
  const message = { senderId: 'other' };
  for (const userStatus of ['user', 'admin', undefined, 'unknown']) assert.equal(canDeleteMessage(message, { isDirect: false, userId: 'me', userStatus }), false);
  assert.equal(canDeleteMessage(message, { isDirect: false, userId: 'me', userStatus: 'superadmin' }), true);
  assert.equal(canDeleteMessage({ ...message, pending: true }, { isDirect: false, userId: 'me', userStatus: 'superadmin' }), false);
  assert.equal(canEditMessage(message, 'me'), false);
});

test('live promotions update all cached badges while preserving chats, reactions and other users', () => {
  const client = new QueryClient();
  const target = { id: 'target', status: 'user', displayName: 'Name', bio: 'Bio' };
  const other = { id: 'other', status: 'superadmin' };
  const message = { id: 'm', senderId: 'target', text: 'Original', readByOther: true, reactions: [{ emoji: '👍', count: 2 }] };
  client.setQueryData(['profile', 'target'], target);
  client.setQueryData(['userSearch', 'ta'], [target, other]);
  client.setQueryData(['conversations'], [{ id: 'c', peer: target, unreadCount: 4 }, { id: 'saved', kind: 'saved', peer: null }]);
  client.setQueryData(['chat', 'general', 'messages'], { pages: [{ messages: [message] }], pageParams: [undefined] });
  client.setQueryData(['messages'], [message]);
  client.setQueryData(['group', 'g'], { title: 'Group', members: [target, other] });
  client.setQueryData(['message-readers', 'g', 'm'], [target]);
  updateAccountCaches(client, { userId: 'target', status: 'admin' });
  assert.equal(client.getQueryData(['profile', 'target']).status, 'admin');
  assert.equal(client.getQueryData(['profile', 'target']).bio, 'Bio');
  assert.equal(client.getQueryData(['userSearch', 'ta'])[1].status, 'superadmin');
  assert.equal(client.getQueryData(['conversations'])[0].unreadCount, 4);
  assert.equal(client.getQueryData(['conversations'])[1].peer, null);
  const updated = client.getQueryData(['chat', 'general', 'messages']).pages[0].messages[0];
  assert.equal(updated.senderStatus, 'admin'); assert.deepEqual(updated.reactions, message.reactions); assert.equal(updated.readByOther, true);
  assert.equal(client.getQueryData(['messages'])[0].senderStatus, 'admin');
  assert.equal(client.getQueryData(['group', 'g']).members[0].status, 'admin');
  assert.equal(client.getQueryData(['message-readers', 'g', 'm'])[0].status, 'admin');
  updateAccountCaches(client, { userId: 'target', status: 'forged' });
  assert.equal(client.getQueryData(['profile', 'target']).status, 'admin');
  client.clear();
});

test('account status and Promote labels are translated in Russian, English and Uzbek', () => {
  assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.ru).sort());
  assert.deepEqual(Object.keys(locales.uz).sort(), Object.keys(locales.ru).sort());
});
