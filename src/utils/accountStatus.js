import { mapPages } from './messageState.js';

const STATUSES = ['user', 'admin', 'superadmin'];
export const accountStatus = (value) => STATUSES.includes(value) ? value : 'user';
export const isSuperadmin = (user) => accountStatus(user?.status) === 'superadmin';
export const canPromoteUser = (actor, target) => isSuperadmin(actor) && Boolean(target?.id) && actor.id !== target.id && accountStatus(target.status) === 'user';

// A promotion updates badges in already loaded chats, search results and open profiles.
export function updateAccountCaches(client, { userId, status }) {
  if (!userId || !STATUSES.includes(status)) return;
  const profile = (user) => user?.id === userId ? { ...user, status } : user;
  const message = (value) => value.senderId === userId ? { ...value, senderStatus: status } : value;
  client.setQueriesData({ queryKey: ['profile'] }, (value) => value ? profile(value) : value);
  client.setQueriesData({ queryKey: ['userSearch'] }, (value) => value?.map(profile));
  client.setQueriesData({ queryKey: ['conversations'] }, (value) => value?.map((chat) => ({ ...chat, peer: profile(chat.peer) })));
  client.setQueriesData({ queryKey: ['chat'] }, (value) => mapPages(value, (messages) => messages.map(message)));
  client.setQueriesData({ queryKey: ['messages'] }, (value) => value?.map(message));
  client.setQueriesData({ queryKey: ['group'] }, (value) => value ? { ...value, members: value.members?.map(profile) } : value);
  client.setQueriesData({ queryKey: ['message-readers'] }, (value) => value?.map(profile));
}
