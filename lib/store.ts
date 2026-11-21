"use client";

// 서버(Redis) 저장. 비밀번호가 있어야 읽고 쓸 수 있고, 서버가 유일한 원본이다.
// - 불러올 때 받은 버전으로만 저장할 수 있어서, 불러오기에 실패한 빈 화면이 서버 내용을 덮어쓰지 못한다.
// - 저장 대기 중인 내용은 브라우저에 임시 보관했다가, 저장되면 지운다.

export type SyncStatus = "loading" | "saving" | "server" | "auth" | "error" | "conflict" | "nostore";

export const STATUS_TEXT: Record<SyncStatus, string> = {
  loading: "불러오는 중…",
  saving: "저장 중…",
  server: "서버에 저장됨",
  auth: "비밀번호를 다시 입력해야 저장됩니다",
  error: "서버 저장 실패 · 다시 시도합니다",
  conflict: "다른 기기에서 먼저 수정됨 · 새로 불러오세요 (지금 내용은 이전 버전에 보관됨)",
  nostore: "서버 저장소 또는 비밀번호가 설정되지 않았습니다",
};

const CODE_KEY = "26center:code";
const LEGACY_PREFIX = "26center:"; // 예전 버전이 브라우저에 저장하던 위치
const UNSAVED_PREFIX = "26center:unsaved:";

// ---------- 비밀번호 (탭을 닫거나 잠기면 사라짐) ----------
export function getAccessCode() {
  try {
    return sessionStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string) {
  try {
    if (code) sessionStorage.setItem(CODE_KEY, code);
    else sessionStorage.removeItem(CODE_KEY);
    localStorage.removeItem("26center:accessCode"); // 예전 버전의 영구 저장 제거
  } catch {}
}

export async function verifyCode(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) return { ok: true };
    const j = await res.json().catch(() => ({}));
    return { ok: false, error: j.error || "확인 실패" };
  } catch {
    return { ok: false, error: "서버에 연결할 수 없습니다." };
  }
}

// ---------- 내부 ----------
const versions = new Map<string, number | null>(); // 키별로 마지막으로 받은 버전
const loaded = new Set<string>(); // 서버에서 제대로 불러온 키

function statusOf(res: Response): SyncStatus {
  if (res.status === 401) return "auth";
  if (res.status === 409) return "conflict";
  if (res.status === 503) return "nostore";
  return res.ok ? "server" : "error";
}
function headers() {
  return { "content-type": "application/json", "x-access-code": getAccessCode() };
}
function lsGet<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function lsSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
function lsDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 서버에서 읽는다. 실패하면 value 는 null 이고 status 로 이유를 알려준다(이때는 편집하면 안 됨). */
export async function loadData<T>(
  key: string,
): Promise<{ value: T | null; status: SyncStatus; fromServer: boolean; recovered: boolean }> {
  try {
    const res = await fetch(`/api/data?key=${encodeURIComponent(key)}`, { headers: headers(), cache: "no-store" });
    const status = statusOf(res);
    if (status !== "server") {
      loaded.delete(key);
      return { value: null, status, fromServer: false, recovered: false };
    }
    const { value, version } = (await res.json()) as { value: T | null; version: number | null };
    versions.set(key, version);
    loaded.add(key);

    // 이 브라우저에 남아 있던 사본(예전 버전의 저장분, 저장 못 한 내용)이 서버와 다르면 백업으로 올려 둔다
    let recovered = false;
    for (const k of [LEGACY_PREFIX + key, UNSAVED_PREFIX + key]) {
      const copy = lsGet<unknown>(k);
      if (copy == null) continue;
      if (!same(copy, value)) {
        const ok = await fetch("/api/data", { method: "POST", headers: headers(), body: JSON.stringify({ key, value: copy }) })
          .then((r) => r.ok)
          .catch(() => false);
        if (!ok) continue;
        recovered = true;
      }
      lsDel(k);
    }
    return { value, status, fromServer: value != null, recovered };
  } catch {
    loaded.delete(key);
    return { value: null, status: "error", fromServer: false, recovered: false };
  }
}

/** 지금 바로 서버에 저장. 불러오지 않은 키는 저장하지 않는다. */
export async function saveData(key: string, value: unknown, source?: "restore"): Promise<SyncStatus> {
  if (!loaded.has(key)) return "conflict"; // 제대로 불러오지 못한 내용으로 덮어쓰지 않음
  lsSet(UNSAVED_PREFIX + key, value);
  try {
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ key, value, base: versions.get(key) ?? null, source }),
    });
    const status = statusOf(res);
    if (status === "server") {
      const { version } = (await res.json()) as { version: number };
      versions.set(key, version);
      lsDel(UNSAVED_PREFIX + key);
    } else if (status === "conflict") {
      lsDel(UNSAVED_PREFIX + key); // 서버가 백업에 보관했음
      loaded.delete(key); // 새로 불러오기 전에는 더 저장하지 않음
    }
    return status;
  } catch {
    return "error";
  }
}

// ---------- 모아서 저장 (입력 0.8초 뒤) + 잠그기 전 즉시 저장 ----------
type Pending = { value: unknown; timer: ReturnType<typeof setTimeout> | null; cb: (s: SyncStatus) => void; source?: "restore" };
const pending = new Map<string, Pending>();

export function queueSave(key: string, value: unknown, cb: (s: SyncStatus) => void, delay = 800, source?: "restore") {
  const prev = pending.get(key);
  if (prev?.timer) clearTimeout(prev.timer);
  lsSet(UNSAVED_PREFIX + key, value);
  const p: Pending = { value, cb, timer: null, source: source ?? prev?.source };
  p.timer = setTimeout(() => void flushKey(key), delay);
  pending.set(key, p);
  cb("saving");
}

async function flushKey(key: string): Promise<SyncStatus> {
  const p = pending.get(key);
  if (!p) return "server";
  if (p.timer) clearTimeout(p.timer);
  p.timer = null;
  const status = await saveData(key, p.value, p.source);
  if (pending.get(key) === p) {
    if (status === "server" || status === "conflict") pending.delete(key);
    else if (status === "error") p.timer = setTimeout(() => void flushKey(key), 5000); // 다시 시도
  }
  p.cb(status);
  return status;
}

/** 저장 대기 중인 것을 모두 저장. 모두 성공하면 true. */
export async function flushAll(): Promise<boolean> {
  const results = await Promise.all([...pending.keys()].map(flushKey));
  return results.every((s) => s === "server" || s === "conflict");
}
export function hasPending() {
  return pending.size > 0;
}

export type Backup<T> = { at: string; v: number; source: "auto" | "browser" | "conflict" | "restore"; value: T };
export async function loadBackups<T>(key: string): Promise<Backup<T>[] | null> {
  try {
    const res = await fetch(`/api/data?key=${encodeURIComponent(key)}&backups=1`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { backups: Backup<T>[] }).backups;
  } catch {
    return null;
  }
}

/** 묶음(예: "records")의 모든 항목을 서버에서 읽는다. 실패하면 null. */
export async function loadList<T>(
  list: string,
): Promise<{ items: { key: string; version: number; at: string; value: T }[] | null; status: SyncStatus }> {
  try {
    const res = await fetch(`/api/data?list=${encodeURIComponent(list)}`, { headers: headers(), cache: "no-store" });
    const status = statusOf(res);
    if (status !== "server") return { items: null, status };
    const { items } = (await res.json()) as { items: { key: string; version: number; at: string; value: T }[] };
    return { items, status };
  } catch {
    return { items: null, status: "error" };
  }
}
