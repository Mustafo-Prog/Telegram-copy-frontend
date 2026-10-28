export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👎'];

export function hasReaction(message, emoji, userId) {
  return Boolean(message.reactions?.find((entry) => entry.emoji === emoji)?.userIds?.includes(userId));
}

export function mergeReactions(message, update) {
  if (message.id !== update.messageId || (message.reactionsVersion ?? 0) > update.reactionsVersion) return message;
  return { ...message, reactions: update.reactions, reactionsVersion: update.reactionsVersion };
}
