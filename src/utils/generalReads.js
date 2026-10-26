// Keep two distinct readers: a message only excludes its own author.
export function mergeGeneralReadCursors(cursors, receipt) {
  const byUser = new Map(cursors.map((cursor) => [cursor.userId, cursor]));
  const previous = byUser.get(receipt.userId);
  if (!previous || receipt.messageId > previous.messageId) byUser.set(receipt.userId, receipt);
  return [...byUser.values()].sort((a, b) => b.messageId.localeCompare(a.messageId)).slice(0, 2);
}

export function applyGeneralReadCursors(messages, cursors) {
  return messages.map((message) => {
    const read = !message.pending && cursors.some((cursor) => cursor.userId !== message.senderId && cursor.messageId >= message.id);
    return read && !message.readByOther ? { ...message, readByOther: true } : message;
  });
}
