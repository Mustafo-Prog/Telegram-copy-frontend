import { mapPages } from './messageState.js';

const STATUSES = ['user', 'admin', 'superadmin'];
export const accountStatus = (value) => STATUSES.includes(value) ? value : 'user';
export const isSuperadmin = (user) => accountStatus(user?.status) === 'superadmin';
export const canPromoteUser = (actor, target) => isSuperadmin(actor) && Boolean(target?.id) && actor.id !== target.id && accountStatus(target.status) !== 'superadmin';

export function effectiveAccountStatus(user, now = Date.now()) {
  const status = accountStatus(user?.status);
  return status === 'admin' && !(new Date(user?.premiumExpiresAt ?? '').getTime() > now) ? 'user' : status;
}

export function mergeAccountUpdate(user, payload) {
  if (user?.id !== payload.userId || (user.premiumVersion ?? 0) > (payload.premiumVersion ?? 0)) return user;
  return { ...user, status: payload.status, premiumExpiresAt: payload.premiumExpiresAt ?? null, premiumVersion: payload.premiumVersion ?? 0 };
}

export function mergeAccountProfile(previous, incoming) {
  if (!previous || !incoming) return incoming;
  const merged = { ...previous, ...incoming };
  if ((previous.premiumVersion ?? 0) > (incoming.premiumVersion ?? 0)) {
    merged.status = previous.status;
    merged.premiumExpiresAt = previous.premiumExpiresAt;
    merged.premiumVersion = previous.premiumVersion;
  }
  return merged;
}

// A promotion updates badges in already loaded chats, search results and open profiles.
export function updateAccountCaches(client, payload) {
  const { userId, status } = payload;
  if (!userId || !STATUSES.includes(status)) return;
  const profile = (user) => mergeAccountUpdate(user, payload);
  const message = (value) => {
    if (value.senderId !== userId || (value.senderPremiumVersion ?? 0) > (payload.premiumVersion ?? 0)) return value;
    return { ...value, senderStatus: status, senderPremiumExpiresAt: payload.premiumExpiresAt ?? null, senderPremiumVersion: payload.premiumVersion ?? 0 };
  };
  client.setQueriesData({ queryKey: ['profile'] }, (value) => value ? profile(value) : value);
  client.setQueriesData({ queryKey: ['userSearch'] }, (value) => value?.map(profile));
  client.setQueriesData({ queryKey: ['conversations'] }, (value) => value?.map((chat) => ({ ...chat, peer: profile(chat.peer) })));
  client.setQueriesData({ queryKey: ['chat'] }, (value) => mapPages(value, (messages) => messages.map(message)));
  client.setQueriesData({ queryKey: ['messages'] }, (value) => value?.map(message));
  client.setQueriesData({ queryKey: ['group'] }, (value) => value ? { ...value, members: value.members?.map(profile) } : value);
  client.setQueriesData({ queryKey: ['message-readers'] }, (value) => value?.map(profile));
}
