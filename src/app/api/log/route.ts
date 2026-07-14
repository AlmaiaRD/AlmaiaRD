import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { level, message, data, url, timestamp } = body;

    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[method](`[CLIENT ${level.toUpperCase()}] ${message}`, {
      data,
      url,
      timestamp,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
