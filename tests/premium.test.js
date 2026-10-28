import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { effectiveAccountStatus, mergeAccountProfile, mergeAccountUpdate, updateAccountCaches } from '../src/utils/accountStatus.js';
import { mergeMessage } from '../src/utils/messageState.js';

test('Premium expires at its exact deadline, invalid dates cannot make it permanent, and superadmin ignores the deadline', () => {
  const now = Date.now();
  for (const premiumExpiresAt of [null, undefined, 'invalid', new Date(now).toISOString(), new Date(now - 1).toISOString()]) assert.equal(effectiveAccountStatus({ status: 'admin', premiumExpiresAt }, now), 'user');
  assert.equal(effectiveAccountStatus({ status: 'admin', premiumExpiresAt: new Date(now + 1).toISOString() }, now), 'admin');
  assert.equal(effectiveAccountStatus({ status: 'superadmin', premiumExpiresAt: new Date(0).toISOString() }, now), 'superadmin');
});

test('delayed expiry events and stale profile requests cannot undo a newer renewal', () => {
  const premium = { id: 'u', status: 'admin', premiumVersion: 5, premiumExpiresAt: '2030-01-01T00:00:00.000Z' };
  const expired = { userId: 'u', status: 'user', premiumVersion: 4, premiumExpiresAt: '2026-01-01T00:00:00.000Z' };
  assert.equal(mergeAccountUpdate(premium, expired), premium);
  assert.equal(mergeAccountProfile(premium, { id: 'u', displayName: 'New name', status: 'user', premiumVersion: 4 }).status, 'admin');
  const client = new QueryClient();
  client.setQueryData(['profile', 'u'], premium);
  client.setQueryData(['chat', 'general', 'messages'], { pages: [{ messages: [{ id: 'm', text: 'Text', senderId: 'u', senderStatus: 'admin', senderPremiumVersion: 5, senderPremiumExpiresAt: premium.premiumExpiresAt }] }] });
  updateAccountCaches(client, expired);
  assert.equal(client.getQueryData(['profile', 'u']).status, 'admin');
  const message = client.getQueryData(['chat', 'general', 'messages']).pages[0].messages[0];
  assert.equal(message.senderStatus, 'admin');
  assert.equal(mergeMessage(message, { id: 'm', text: 'Edited', senderStatus: 'user', senderPremiumVersion: 4 }).senderStatus, 'admin');
  updateAccountCaches(client, { ...expired, premiumVersion: 6 });
  assert.equal(client.getQueryData(['profile', 'u']).status, 'user');
  client.clear();
});
