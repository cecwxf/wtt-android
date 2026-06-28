export type MobileHistoryMessage = {
  message_id?: string;
  id?: string;
  timestamp?: string;
  created_at?: string;
};

function messageKey(message: MobileHistoryMessage) {
  return String(message.message_id || message.id || '');
}

function messageTime(message: MobileHistoryMessage) {
  return String(message.timestamp || message.created_at || '');
}

export function mergeMobileHistory<T extends MobileHistoryMessage>(
  previous: T[] | undefined,
  incoming: T[],
) {
  const prev = previous || [];
  if (!incoming.length) return prev;

  const byId = new Map<string, T>();
  for (const message of prev) {
    const key = messageKey(message);
    if (key) byId.set(key, message);
  }
  for (const message of incoming) {
    const key = messageKey(message);
    if (key) byId.set(key, message);
  }

  return Array.from(byId.values()).sort((a, b) => messageTime(a).localeCompare(messageTime(b)));
}
