export function sortChats(chats) {
  return [...chats].sort((a, b) => Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) ||
    (a.pinnedAt && b.pinnedAt ? new Date(b.pinnedAt) - new Date(a.pinnedAt) : new Date(b.lastMessageAt ?? 0) - new Date(a.lastMessageAt ?? 0)) || a.id.localeCompare(b.id));
}
