import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 저장 가능한 키: 월별 경비내역서, 부과항목 목록, 단가 계산 기록, 총회 준비
const KEY_RE = /^(expense:\d{4}-\d{2}|categories|history:(electric|water)|meeting:current)$/;
const PREFIX = "26center:";
const BACKUP_PREFIX = "26center:backup:";
const BACKUP_KEEP = 200; // 키마다 보관할 백업 수
const BACKUP_EVERY_MS = 10 * 60 * 1000; // 자동 백업 간격 (10분)

// 저장 형식: { _env: 1, v: 버전, at: 저장시각, value }
type Envelope = { _env: 1; v: number; at: string; value: unknown };
export type BackupEntry = { at: string; v: number; source: "auto" | "browser" | "conflict" | "restore"; value: unknown };

function redis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function unwrap(raw: unknown): Envelope | null {
  if (raw == null) return null;
  if (typeof raw === "object" && (raw as Envelope)._env === 1) return raw as Envelope;
  return { _env: 1, v: 0, at: "", value: raw }; // 예전 형식
}

function guard(req: Request, key: string | null | undefined) {
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.json({ error: "no-access-code" }, { status: 503 });
  if (req.headers.get("x-access-code") !== code) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!key || !KEY_RE.test(key)) return NextResponse.json({ error: "bad-key" }, { status: 400 });
  const r = redis();
  if (!r) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  return r;
}

async function pushBackup(r: Redis, key: string, entry: BackupEntry) {
  await r.lpush(BACKUP_PREFIX + key, JSON.stringify(entry));
  await r.ltrim(BACKUP_PREFIX + key, 0, BACKUP_KEEP - 1);
}

// GET ?key=...            현재 값
// GET ?key=...&backups=1  백업 목록 (최신순)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const r = guard(req, key);
  if (r instanceof NextResponse) return r;
  if (url.searchParams.get("backups")) {
    const list = (await r.lrange(BACKUP_PREFIX + key, 0, BACKUP_KEEP - 1)) as BackupEntry[];
    return NextResponse.json({ backups: list });
  }
  const env = unwrap(await r.get(PREFIX + key));
  return NextResponse.json({ value: env?.value ?? null, version: env?.v ?? null, at: env?.at ?? null });
}

// PUT { key, value, base }  base = 불러올 때 받은 버전 (없던 값이면 null)
// 그 사이 다른 곳에서 저장했으면 409 로 거절해 덮어쓰지 않는다.
export async function PUT(req: Request) {
  const body = (await req.json()) as { key: string; value: unknown; base: number | null; source?: BackupEntry["source"] };
  const r = guard(req, body?.key);
  if (r instanceof NextResponse) return r;
  const json = JSON.stringify(body.value);
  if (json.length > 900_000) return NextResponse.json({ error: "too-large" }, { status: 413 });

  const cur = unwrap(await r.get(PREFIX + body.key));
  const curV = cur ? cur.v : null;
  if (curV !== (body.base ?? null)) {
    // 덮어쓰지 않고, 보내온 내용은 백업에 보관
    await pushBackup(r, body.key, { at: new Date().toISOString(), v: curV ?? 0, source: "conflict", value: body.value });
    return NextResponse.json({ error: "conflict", version: curV }, { status: 409 });
  }

  if (cur) {
    // 서버에 있던 내용을 10분에 한 번(되돌리기 때는 항상) 보관
    const lastAuto = Number(await r.get(BACKUP_PREFIX + body.key + ":lastAuto")) || 0;
    if (Date.now() - lastAuto > BACKUP_EVERY_MS || body.source === "restore") {
      await pushBackup(r, body.key, { at: cur.at || new Date().toISOString(), v: cur.v, source: "auto", value: cur.value });
      await r.set(BACKUP_PREFIX + body.key + ":lastAuto", String(Date.now()));
    }
  }
  const next: Envelope = { _env: 1, v: (curV ?? 0) + 1, at: new Date().toISOString(), value: body.value };
  await r.set(PREFIX + body.key, JSON.stringify(next));
  return NextResponse.json({ ok: true, version: next.v });
}

// POST { key, value }  브라우저에 남아 있던 사본을 백업으로 보관 (복구용)
export async function POST(req: Request) {
  const body = (await req.json()) as { key: string; value: unknown };
  const r = guard(req, body?.key);
  if (r instanceof NextResponse) return r;
  await pushBackup(r, body.key, { at: new Date().toISOString(), v: 0, source: "browser", value: body.value });
  return NextResponse.json({ ok: true });
}
