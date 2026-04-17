import { NextResponse } from "next/server";

import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await readDb();
    return NextResponse.json({
      ok: true,
      db: "up",
      ts: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: error instanceof Error ? error.message : "unknown"
      },
      { status: 503 }
    );
  }
}
