"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushAll, getAccessCode, hasPending, setAccessCode, verifyCode } from "@/lib/store";

// 입력이 없을 때 자동으로 잠그는 시간(분). Vercel 환경변수 NEXT_PUBLIC_IDLE_MINUTES 로 바꿀 수 있음.
const IDLE_MIN = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES) || 30;
const WARN_SEC = 60;
const ACTIVITY = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const;

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [everOpened, setEverOpened] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockNote, setLockNote] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const last = useRef(Date.now());

  // 처음: 이 탭에 비밀번호가 있으면 확인
  useEffect(() => {
    const c = getAccessCode();
    if (!c) return setState("locked");
    verifyCode(c).then((r) => {
      if (r.ok) {
        setState("open");
        setEverOpened(true);
      } else {
        setAccessCode("");
        setState("locked");
      }
    });
  }, []);

  const lock = useCallback(async (note: string) => {
    // 잠그기 전에 입력한 내용을 먼저 서버에 저장
    const saved = await flushAll();
    setAccessCode("");
    setLeft(null);
    setLockNote(
      saved
        ? note
        : `${note} 저장하지 못한 내용이 있어 화면 뒤에 그대로 두었습니다. 다시 들어오면 이어서 저장합니다.`,
    );
    setState("locked");
  }, []);

  // 입력 감지 + 자동 잠금
  useEffect(() => {
    if (state !== "open") return;
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const idle = (Date.now() - last.current) / 1000;
      const remain = IDLE_MIN * 60 - idle;
      if (remain <= 0) void lock(`${IDLE_MIN}분 동안 입력이 없어 잠겼습니다.`);
      else setLeft(remain <= WARN_SEC ? Math.ceil(remain) : null);
    }, 1000);
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [state, lock]);

  // 저장 안 된 내용이 있을 때 창 닫기 경고
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (hasPending()) {
        void flushAll();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await verifyCode(code);
    setBusy(false);
    if (!r.ok) return setError(r.error || "확인 실패");
    setAccessCode(code);
    setCode("");
    setLockNote("");
    setState("open");
    setEverOpened(true);
    void flushAll(); // 잠겨 있는 동안 못 한 저장 이어서
  }

  return (
    <>
      {state === "open" && (
        <div className="session no-print">
          {left != null && <span className="warn-idle">입력이 없어 {left}초 후 잠깁니다</span>}
          <button className="ghost small" onClick={() => void lock("로그아웃했습니다.")}>
            잠그기
          </button>
        </div>
      )}
      {state === "checking" && <p className="muted">확인 중…</p>}
      {state === "locked" && (
        <form className="card login" onSubmit={submit}>
          <h1>26센터 관리</h1>
          {lockNote && <p className="note">{lockNote}</p>}
          <label htmlFor="code">비밀번호</label>
          <input
            id="code"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" disabled={busy || !code}>
            {busy ? "확인 중…" : "들어가기"}
          </button>
          {error && <p className="error">{error}</p>}
          <p className="muted small">{IDLE_MIN}분 동안 입력이 없으면 자동으로 잠깁니다. 입력한 내용은 잠기기 전에 저장됩니다.</p>
        </form>
      )}
      {/* 한 번 들어온 뒤에는 잠겨도 화면을 지우지 않고 숨겨서, 저장 못 한 내용이 사라지지 않게 한다 */}
      {everOpened && <div style={{ display: state === "open" ? undefined : "none" }}>{children}</div>}
    </>
  );
}
