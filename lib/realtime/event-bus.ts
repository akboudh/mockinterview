import type { RealtimeEventEnvelope } from "@/lib/types";

type Subscriber = {
  filter: (event: RealtimeEventEnvelope) => boolean;
  notify: (event: RealtimeEventEnvelope) => void;
};

const subscribers = new Map<string, Subscriber>();

export function subscribeRealtimeEvents(params: {
  filter?: (event: RealtimeEventEnvelope) => boolean;
  notify: (event: RealtimeEventEnvelope) => void;
}) {
  const subscriberId = crypto.randomUUID();

  subscribers.set(subscriberId, {
    filter: params.filter ?? (() => true),
    notify: params.notify
  });

  return () => {
    subscribers.delete(subscriberId);
  };
}

export function publishRealtimeEvent(event: RealtimeEventEnvelope) {
  for (const subscriber of subscribers.values()) {
    if (!subscriber.filter(event)) {
      continue;
    }

    subscriber.notify(event);
  }
}

export function clearRealtimeSubscribers() {
  subscribers.clear();
}

export function formatSseEvent(event: RealtimeEventEnvelope) {
  return `id: ${event.event_id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
