export type ConversationLiveEvent =
  | { type: "message"; conversationRef: string }
  | { type: "typing"; conversationRef: string; handle: string; at: string }
  | { type: "read"; conversationRef: string }
  | { type: "vanish"; conversationRef: string; vanishMode: boolean }
  | { type: "purge"; conversationRef: string };

type Listener = (event: ConversationLiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const typing = new Map<string, { handle: string; at: number }>();

export function subscribeConversation(ref: string, listener: Listener): () => void {
  const set = listeners.get(ref) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(ref, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(ref);
    }
  };
}

export function publishConversation(event: ConversationLiveEvent): void {
  const set = listeners.get(event.conversationRef);
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener(event);
  }
}

export function setTyping(conversationRef: string, handle: string): void {
  typing.set(conversationRef, { handle, at: Date.now() });
  publishConversation({
    type: "typing",
    conversationRef,
    handle,
    at: new Date().toISOString(),
  });
}

export function getTyping(conversationRef: string, excludeHandle?: string): string | null {
  const row = typing.get(conversationRef);
  if (!row) {
    return null;
  }
  if (Date.now() - row.at > 4000) {
    typing.delete(conversationRef);
    return null;
  }
  if (excludeHandle && row.handle === excludeHandle) {
    return null;
  }
  return row.handle;
}
