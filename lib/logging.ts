type LogLevel = "info" | "warn" | "error";

function formatLogEntry(event: string, payload: Record<string, unknown>) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...payload
  });
}

export function requestIdFromRequest(request: Request) {
  return request.headers.get("x-request-id") ?? undefined;
}

export function logEvent(
  event: string,
  payload: Record<string, unknown> = {},
  level: LogLevel = "info"
) {
  const message = formatLogEntry(event, payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.log(message);
}
