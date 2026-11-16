import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 저장 가능한 키: 월별 경비내역서, 부과항목 목록, 단가 계산 기록
const KEY_RE = /^(expense:\d{4}-\d{2}|categories|history:(electric|water))$/;
const PREFIX = "26center:";

function redis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function check(req: Request, key: string | null) {
  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  if (!key || !KEY_RE.test(key)) return NextResponse.json({ error: "bad-key" }, { status: 400 });
  return null;
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const bad = check(req, key);
  if (bad) return bad;
  const r = redis();
  if (!r) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  const value = await r.get(PREFIX + key);
  return NextResponse.json({ value: value ?? null });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { key: string; value: unknown };
  const bad = check(req, body?.key ?? null);
  if (bad) return bad;
  const r = redis();
  if (!r) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  const json = JSON.stringify(body.value);
  if (json.length > 900_000) return NextResponse.json({ error: "too-large" }, { status: 413 });
  await r.set(PREFIX + body.key, json);
  return NextResponse.json({ ok: true });
}
