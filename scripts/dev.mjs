#!/usr/bin/env node

import net from "node:net";
import { spawn } from "node:child_process";

const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

function canListenOnPort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

async function findAvailablePort(startPort, host) {
  let port = startPort;

  while (!(await canListenOnPort(port, host))) {
    port += 1;
  }

  return port;
}

const surface = (process.env.APP_SURFACE ?? "").trim().toLowerCase();
const splitSurface = surface === "student" || surface === "mentor";

let port = DEFAULT_PORT;

if (splitSurface) {
  // In split mode we must avoid "both processes pick same free port" races.
  // Require the explicit port to be free, otherwise fail fast with a clear message.
  const ok = await canListenOnPort(port, HOST);
  if (!ok) {
    console.error(
      `[dev] Port ${port} is busy for ${surface} (${HOST}). ` +
        "In split dev, free ports 3000/3001 (or change PORT in the npm scripts) and rerun."
    );
    process.exit(1);
  }
} else {
  port = await findAvailablePort(DEFAULT_PORT, HOST);
  if (port !== DEFAULT_PORT) {
    console.log(`Port ${DEFAULT_PORT} is busy. Starting dev server on ${port}.`);
  }
}

if ((surface === "student" || surface === "mentor") && !process.env.REDIS_URL?.trim()) {
  console.warn(
    "[dev] APP_SURFACE is set but REDIS_URL is empty. " +
      "Split student/mentor dev will use the SQLite realtime bridge fallback (works, slightly higher latency). " +
      "Set REDIS_URL for best realtime performance."
  );
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--hostname", HOST, "--port", String(port)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(port),
      HOST
    }
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
