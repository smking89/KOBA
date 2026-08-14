export type AuctionLiveEvent = {
  slug: string;
  highBidCents: number | null;
  bidCount: number;
  endsAt: string;
  status: string;
};

type Listener = (event: AuctionLiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeAuction(slug: string, listener: Listener): () => void {
  const set = listeners.get(slug) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(slug, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(slug);
    }
  };
}

export function publishAuction(event: AuctionLiveEvent): void {
  const set = listeners.get(event.slug);
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener(event);
  }
}
