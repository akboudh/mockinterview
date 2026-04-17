import Redis from "ioredis";
import Database from "better-sqlite3";
import path from "path";

import type { RealtimeEventEnvelope } from "@/lib/types";

type Subscriber = {
  filter: (event: RealtimeEventEnvelope) => boolean;
  notify: (event: RealtimeEventEnvelope) => void;
};

const subscribers = new Map<string, Subscriber>();

const REDIS_CHANNEL = "vantage:realtime";
const INSTANCE_ORIGIN = `pid:${process.pid}:${crypto.randomUUID()}`;

let redisPublisher: Redis | null = null;
let redisSubscriber: Redis | null = null;

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() || "";
}

function getSqlitePath() {
  const DEFAULT_SQLITE_PATH = "data/mockinterview.sqlite";
  const configured = process.env.DATABASE_URL?.trim();
  const resolved = configured
    ? configured.startsWith("file:")
      ? configured.slice(5)
      : configured
    : DEFAULT_SQLITE_PATH;

  return path.isAbsolute(resolved) ? resolved : path.join(process.cwd(), resolved);
}

let sqliteBridgeDb: Database.Database | null = null;
let sqliteBridgePoller: NodeJS.Timeout | null = null;
let sqliteBridgeLastSeenId: number | null = null;

function ensureSqliteBridge() {
  if (sqliteBridgeDb || process.env.VITEST) {
    return;
  }

  try {
    const sqlitePath = getSqlitePath();
    sqliteBridgeDb = new Database(sqlitePath, { timeout: 5000 });
    sqliteBridgeDb.pragma("busy_timeout = 5000");

    sqliteBridgeDb.exec(`
      CREATE TABLE IF NOT EXISTS realtime_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origin TEXT NOT NULL,
        created_at TEXT NOT NULL,
        event_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events (created_at);
    `);

    const row = sqliteBridgeDb.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM realtime_events").get() as
      | { max_id: number }
      | undefined;
    sqliteBridgeLastSeenId = row?.max_id ?? 0;

    sqliteBridgePoller = setInterval(() => {
      if (!sqliteBridgeDb) {
        return;
      }

      const since = sqliteBridgeLastSeenId ?? 0;
      const rows = sqliteBridgeDb
        .prepare(
          "SELECT id, origin, event_json FROM realtime_events WHERE id > ? ORDER BY id ASC LIMIT 250"
        )
        .all(since) as Array<{ id: number; origin: string; event_json: string }>;

      if (!rows.length) {
        return;
      }

      for (const entry of rows) {
        sqliteBridgeLastSeenId = entry.id;
        if (entry.origin === INSTANCE_ORIGIN) {
          continue;
        }
        try {
          const event = JSON.parse(entry.event_json) as RealtimeEventEnvelope;
          dispatchToLocalSubscribers(event);
        } catch {
          /* ignore malformed */
        }
      }
    }, 500);
  } catch (error) {
    console.warn("[realtime] SQLite bridge unavailable; using in-process bus only.", error);
    sqliteBridgeDb = null;
    if (sqliteBridgePoller) {
      clearInterval(sqliteBridgePoller);
      sqliteBridgePoller = null;
    }
    sqliteBridgeLastSeenId = null;
  }
}

function ensureRedisBridge() {
  const url = getRedisUrl();
  if (!url || redisSubscriber || process.env.VITEST) {
    return;
  }

  try {
    redisPublisher = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    redisSubscriber = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });

    redisSubscriber.subscribe(REDIS_CHANNEL, (err, _count) => {
      if (err) {
        console.warn("[realtime] Redis subscribe failed; using in-process bus only.", err.message);
      }
    });

    redisSubscriber.on("message", (_channel, message) => {
      try {
        const payload = JSON.parse(message) as {
          origin?: string;
          event: RealtimeEventEnvelope;
        };
        if (payload.origin === INSTANCE_ORIGIN) {
          return;
        }
        dispatchToLocalSubscribers(payload.event);
      } catch {
        /* ignore malformed */
      }
    });
  } catch (error) {
    console.warn("[realtime] Redis unavailable; using in-process bus only.", error);
    redisPublisher = null;
    redisSubscriber = null;
  }
}

function dispatchToLocalSubscribers(event: RealtimeEventEnvelope) {
  for (const subscriber of subscribers.values()) {
    if (!subscriber.filter(event)) {
      continue;
    }
    subscriber.notify(event);
  }
}

export function subscribeRealtimeEvents(params: {
  filter?: (event: RealtimeEventEnvelope) => boolean;
  notify: (event: RealtimeEventEnvelope) => void;
}) {
  ensureRedisBridge();
  ensureSqliteBridge();

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
  dispatchToLocalSubscribers(event);

  const url = getRedisUrl();
  if (url) {
    ensureRedisBridge();
    if (!redisPublisher) {
      return;
    }

    const payload = JSON.stringify({ origin: INSTANCE_ORIGIN, event });
    void redisPublisher.publish(REDIS_CHANNEL, payload).catch((error) => {
      console.warn("[realtime] Redis publish failed.", error instanceof Error ? error.message : error);
    });
    return;
  }

  ensureSqliteBridge();
  if (!sqliteBridgeDb) {
    return;
  }

  try {
    sqliteBridgeDb
      .prepare(
        "INSERT INTO realtime_events (origin, created_at, event_json) VALUES (?, ?, ?)"
      )
      .run(INSTANCE_ORIGIN, event.created_at, JSON.stringify(event));
  } catch (error) {
    console.warn(
      "[realtime] SQLite publish failed.",
      error instanceof Error ? error.message : error
    );
  }
}

export function clearRealtimeSubscribers() {
  subscribers.clear();
}

export function formatSseEvent(event: RealtimeEventEnvelope) {
  return `id: ${event.event_id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
