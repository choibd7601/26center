"use client";

import { useState } from "react";
import { STATUS_TEXT, getAccessCode, setAccessCode, type SyncStatus } from "@/lib/store";

export default function SyncBadge({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const [code, setCode] = useState("");
  const ok = status === "server";
  return (
    <span className={`sync ${ok ? "ok" : status === "loading" || status === "saving" ? "" : "bad"}`}>
      {STATUS_TEXT[status]}
      {status === "auth" && (
        <>
          {" "}
          <input
            className="code"
            type="password"
            placeholder="접속코드"
            defaultValue={getAccessCode()}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="small"
            onClick={() => {
              setAccessCode(code);
              onRetry();
            }}
          >
            확인
          </button>
        </>
      )}
      {(status === "error" || status === "local") && (
        <button className="ghost small" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </span>
  );
}
