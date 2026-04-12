# Realtime Event Contract

The app now ships with a lightweight Server-Sent Events channel instead of a future-only socket placeholder.

## Endpoint

- Session scope: `GET /events/stream?scope=session&session_id={session_id}`
- Mentor scope: `GET /events/stream?scope=mentor`

Session streams require an authenticated owner of the session. Mentor streams require a `mentor` or `admin` role.

## Event Types

- `stream.connected`
- `session.flag.created`
- `session.flag.reviewed`
- `session.mentor.feedback`
- `session.mentor.takeover`

## Payload Shape

```json
{
  "event_id": "string",
  "type": "session.flag.created",
  "session_id": "string",
  "user_id": "string",
  "audience": "session",
  "created_at": "ISO-8601",
  "payload": {}
}
```

## Current UI Usage

- The live interview page subscribes to session-scoped events so guardrail flags and mentor takeover actions appear promptly.
- The mentor dashboard subscribes to mentor-scoped events so new and reviewed flags show up without waiting for manual refresh.
