"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../meeting/meeting.css";
import "./records.css";
import { loadBackups, loadData, loadList, queueSave, type Backup, type SyncStatus } from "@/lib/store";
import SyncBadge from "@/components/SyncBadge";
import {
  ATTEND_LABEL,
  RESOLUTION,
  VOTE_LABEL,
  fmtDate,
  fmtNum,
  normalizeMeeting,
  pct,
  type Attend,
  type Meeting,
  type ResolutionType,
  type Vote,
} from "@/lib/meeting";
import {
  KIND_LABEL,
  KIND_SHORT,
  RESULT_LABEL,
  STATUS_LABEL,
  countVotes,
  defaultAttachments,
  emptyAttach,
  emptyAttendee,
  emptyFollowUp,
  emptyRecordAgenda,
  fromMeeting,
  isAssembly,
  judge,
  makeId,
  minutesName,
  newRecord,
  normalizeRecord,
  recordAttendance,
  recordTitle,
  recordTotals,
  summarize,
  type Attendee,
  type Count,
  type MeetingRecord,
  type RecordAgenda,
  type RecordKind,
  type RecordSummary,
  type ResultChoice,
} from "@/lib/records";
import { DOC_CSS } from "@/components/meeting/Docs";
import { RECORD_CSS, RECORD_DOCS, RecordDocView, type RecordDocKey } from "@/components/records/RecordDocs";

const keyOf = (id: string) => `records:${id}`;
const KINDS: RecordKind[] = ["regular", "special", "committee", "other"];

function setUrl(id: string | null) {
  try {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("id", id);
    else u.searchParams.delete("id");
    window.history.replaceState(null, "", u.toString());
  } catch {}
}

export default function RecordsPage() {
  const [open, setOpen] = useState<{ id: string; init?: MeetingRecord } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id && /^[a-z0-9]{4,40}$/.test(id)) setOpen({ id });
    setReady(true);
  }, []);

  const go = useCallback((o: { id: string; init?: MeetingRecord } | null) => {
    setOpen(o);
    setUrl(o?.id ?? null);
    window.scrollTo({ top: 0 });
  }, []);

  if (!ready) return <p className="muted">불러오는 중…</p>;
  return (
    <div className="mt rc">
      {open ? <Editor key={open.id} id={open.id} init={open.init} go={go} /> : <List go={go} />}
    </div>
  );
}

/* ================= 목록 ================= */

function List({ go }: { go: (o: { id: string; init?: MeetingRecord } | null) => void }) {
  const [items, setItems] = useState<RecordSummary[] | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [reload, setReload] = useState(0);
  const [kind, setKind] = useState<RecordKind | "">("");
  const [year, setYear] = useState("");
  const [q, setQ] = useState("");
  const [trash, setTrash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    loadList<MeetingRecord>("records").then(({ items, status }) => {
      if (!alive) return;
      setStatus(status);
      if (!items) return setItems(null);
      setItems(
        items
          .map((it) => {
            const r = normalizeRecord(it.value, it.key.slice("records:".length));
            return r ? summarize(r, it.at) : null;
          })
          .filter((x): x is RecordSummary => !!x),
      );
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  const years = useMemo(() => [...new Set((items ?? []).map((i) => i.date.slice(0, 4)).filter(Boolean))].sort().reverse(), [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? [])
      .filter((i) => i.deleted === trash)
      .filter((i) => !kind || i.kind === kind)
      .filter((i) => !year || i.date.startsWith(year))
      .filter((i) => !s || [i.title, i.place, ...i.agendas].join(" ").toLowerCase().includes(s))
      .sort((a, b) => (b.date || "9999").localeCompare(a.date || "9999") || b.at.localeCompare(a.at));
  }, [items, kind, year, q, trash]);
  const trashCount = (items ?? []).filter((i) => i.deleted).length;

  function create(k: RecordKind) {
    const id = makeId();
    go({ id, init: newRecord(k, id) });
  }

  async function importMeeting() {
    setBusy(true);
    setMsg("");
    const { value, status } = await loadData<Meeting>("meeting:current");
    setBusy(false);
    const m = normalizeMeeting(value);
    if (status !== "server" || !m) return setMsg(status !== "server" ? "총회 준비 내용을 불러오지 못했습니다." : "총회 준비에 저장된 내용이 없습니다.");
    const id = makeId();
    go({ id, init: fromMeeting(m, newRecord(m.kind, id)) });
  }

  return (
    <>
      <div className="mt-head">
        <div>
          <h1>집합건물 회의관리</h1>
          <p className="muted small" style={{ margin: 0 }}>
            관리단집회(정기·임시총회)·관리위원회 등 회의별 회의록과 관련 서류를 작성·인쇄하고 서버에 보관합니다.
          </p>
        </div>
        <SyncBadge status={status} onRetry={() => setReload((n) => n + 1)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>새 회의 기록</h2>
        <div className="row">
          {KINDS.map((k) => (
            <button key={k} onClick={() => create(k)} disabled={status !== "server"}>
              + {KIND_LABEL[k]}
            </button>
          ))}
          <button className="ghost" onClick={importMeeting} disabled={busy || status !== "server"} title="총회 준비 메뉴의 기본정보·안건·명부·투표·의사록 입력값으로 새 기록을 만듭니다">
            {busy ? "불러오는 중…" : "‘총회 준비’ 내용으로 만들기"}
          </button>
        </div>
        {msg && <p className="warn small">{msg}</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ marginTop: 0 }}>
          <h2 style={{ margin: 0 }}>{trash ? "휴지통" : "회의 목록"}</h2>
          <select value={kind} onChange={(e) => setKind(e.target.value as RecordKind | "")} style={{ width: "auto" }}>
            <option value="">전체 종류</option>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: "auto" }}>
            <option value="">전체 연도</option>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <input placeholder="제목·안건·장소 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button className="ghost small" onClick={() => setTrash(!trash)}>
            {trash ? "목록으로" : `휴지통 (${trashCount})`}
          </button>
        </div>
        {items == null ? (
          <p className="muted">{status === "loading" ? "불러오는 중…" : "목록을 불러오지 못했습니다. ‘다시 시도’를 눌러 주세요."}</p>
        ) : shown.length === 0 ? (
          <p className="muted">{trash ? "휴지통이 비어 있습니다." : items.length ? "조건에 맞는 회의가 없습니다." : "아직 저장된 회의가 없습니다. 위에서 새 회의 기록을 만드세요."}</p>
        ) : (
          <div className="mt-scroll">
            <table className="table rc-list">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>일자</th>
                  <th style={{ width: 90 }}>종류</th>
                  <th>회의 · 안건(결과)</th>
                  <th style={{ width: 80 }}>상태</th>
                  <th style={{ width: 90 }}>후속조치</th>
                  <th style={{ width: 140 }}>마지막 저장</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id} onClick={() => go({ id: i.id })} className="rc-row">
                    <td>{i.date ? fmtDate(i.date) : <span className="muted">미정</span>}</td>
                    <td><span className={`rc-kind k-${i.kind}`}>{KIND_SHORT[i.kind]}</span></td>
                    <td>
                      <b>{i.title}</b>
                      {i.place && <span className="muted small"> · {i.place}</span>}
                      {i.agendas.length > 0 && (
                        <div className="small muted">
                          {i.agendas.map((a, n) => (
                            <span key={n} className="rc-ag">
                              {a}
                              {i.results[n] && <b className={i.results[n] === "가결" ? "mt-yes" : i.results[n] === "부결" ? "mt-no" : ""}> {i.results[n]}</b>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td><span className={`rc-st ${i.status}`}>{STATUS_LABEL[i.status]}</span></td>
                    <td>{i.openFollowUps ? <span className="mt-no">미완료 {i.openFollowUps}</span> : <span className="muted">-</span>}</td>
                    <td className="small muted">{i.at ? new Date(i.at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">회의마다 따로 서버에 저장되고, 고칠 때마다 이전 버전이 자동 보관됩니다. 삭제하면 휴지통으로 옮겨지며 언제든 되살릴 수 있습니다.</p>
      </div>
    </>
  );
}

/* ================= 편집 ================= */

type Tab = "info" | "people" | "agenda" | "files" | "docs";
const TABS: [Tab, string][] = [
  ["info", "① 기본정보"],
  ["people", "② 참석자"],
  ["agenda", "③ 보고·안건·의결"],
  ["files", "④ 첨부서류·후속조치"],
  ["docs", "⑤ 문서 만들기"],
];
const SOURCE_LABEL: Record<string, string> = { auto: "자동 보관", browser: "브라우저 사본", conflict: "충돌 시 보관", restore: "되돌리기 전" };

type Up = (p: Partial<MeetingRecord>) => void;

function F({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`f ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Editor({ id, init, go }: { id: string; init?: MeetingRecord; go: (o: { id: string; init?: MeetingRecord } | null) => void }) {
  const KEY = keyOf(id);
  const [r, setR] = useState<MeetingRecord | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [loadFail, setLoadFail] = useState<SyncStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>(init ? "info" : "docs");
  const [doc, setDoc] = useState<RecordDocKey>("minutes");
  const [backups, setBackups] = useState<Backup<MeetingRecord>[] | null>(null);
  const [showBackups, setShowBackups] = useState(false);
  const [notice, setNotice] = useState("");
  const skipSave = useRef(true);
  const initRef = useRef(init);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    loadData<MeetingRecord>(KEY).then(({ value, status, recovered }) => {
      if (!alive) return;
      setStatus(status);
      if (status !== "server") {
        setLoadFail(status);
        return;
      }
      setLoadFail(null);
      const loaded = normalizeRecord(value, id);
      if (loaded) {
        skipSave.current = true;
        setR(loaded);
        setNotFound(false);
      } else if (initRef.current) {
        skipSave.current = false; // 새 회의: 바로 서버에 저장해 목록에 나오게
        setR(initRef.current);
        initRef.current = undefined;
      } else {
        setNotFound(true);
      }
      if (recovered) setNotice("이 브라우저에 남아 있던 저장 안 된 내용을 ‘이전 버전’에 보관했습니다.");
    });
    return () => {
      alive = false;
    };
  }, [KEY, id, reload]);

  useEffect(() => {
    if (!r) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    queueSave(KEY, r, setStatus);
  }, [r, KEY]);

  if (loadFail)
    return (
      <div className="card">
        <p className="warn">회의 기록을 서버에서 불러오지 못해 편집할 수 없습니다. (내용이 덮어써지지 않도록 막아 두었습니다)</p>
        <div className="row">
          <SyncBadge status={loadFail} onRetry={() => setReload((n) => n + 1)} />
          <button className="ghost" onClick={() => go(null)}>목록으로</button>
        </div>
      </div>
    );
  if (notFound)
    return (
      <div className="card">
        <p>이 회의 기록을 찾을 수 없습니다.</p>
        <button className="ghost" onClick={() => go(null)}>목록으로</button>
      </div>
    );
  if (!r) return <p className="muted">불러오는 중…</p>;

  const up: Up = (p) => setR({ ...r, ...p });
  const locked = r.status === "final";

  async function openBackups() {
    setShowBackups(true);
    setBackups(null);
    setBackups((await loadBackups<MeetingRecord>(KEY)) ?? []);
  }
  function restore(b: Backup<MeetingRecord>) {
    const x = normalizeRecord(b.value, id);
    if (!x) return;
    if (!confirm(`${new Date(b.at).toLocaleString("ko-KR")} 버전으로 되돌릴까요? 지금 내용은 이전 버전 목록에 보관됩니다.`)) return;
    skipSave.current = true;
    setR(x);
    queueSave(KEY, x, setStatus, 0, "restore");
    setShowBackups(false);
  }
  function duplicate() {
    const nid = makeId();
    const copy: MeetingRecord = {
      ...structuredClone(r!),
      id: nid,
      status: "draft",
      deleted: false,
      title: r!.title ? `${r!.title} (사본)` : "",
      createdAt: new Date().toISOString(),
    };
    go({ id: nid, init: copy });
  }

  return (
    <>
      <div className="mt-head no-print">
        <div>
          <button className="ghost small" onClick={() => go(null)}>← 회의 목록</button>
          <h1 style={{ marginTop: 6 }}>
            {recordTitle(r)} {r.deleted && <span className="rc-st deleted">휴지통</span>}
          </h1>
          <p className="muted small" style={{ margin: 0 }}>
            {r.date ? fmtDate(r.date) : "일자 미정"}
            {r.place ? ` · ${r.place}` : ""}
          </p>
        </div>
        <div className="row">
          <div className="mt-seg">
            {(["draft", "final"] as const).map((s) => (
              <button key={s} className={r.status === s ? "on" : ""} onClick={() => up({ status: s })}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <SyncBadge status={status} onRetry={() => setReload((n) => n + 1)} />
          <button className="ghost small" onClick={openBackups}>이전 버전</button>
          <button className="ghost small" onClick={duplicate} title="이 회의를 복사해 새 기록을 만듭니다">복제</button>
          {r.deleted ? (
            <button className="ghost small" onClick={() => up({ deleted: false })}>되살리기</button>
          ) : (
            <button
              className="ghost small danger"
              onClick={() => {
                if (confirm("이 회의 기록을 휴지통으로 옮길까요? 휴지통에서 언제든 되살릴 수 있습니다.")) {
                  up({ deleted: true });
                }
              }}
            >
              휴지통으로
            </button>
          )}
        </div>
      </div>

      {notice && <p className="warn no-print">{notice}</p>}
      {showBackups && (
        <section className="card no-print" style={{ marginTop: 12 }}>
          <div className="row">
            <h2 style={{ margin: 0 }}>이전 버전</h2>
            <button className="ghost small" onClick={() => setShowBackups(false)}>닫기</button>
          </div>
          <p className="muted small">수정하는 동안 10분마다, 그리고 되돌리기·충돌 때 자동으로 보관됩니다 (최근 200개).</p>
          {backups == null ? (
            <p className="muted">불러오는 중…</p>
          ) : backups.length === 0 ? (
            <p className="muted">보관된 이전 버전이 없습니다.</p>
          ) : (
            <table className="table">
              <thead><tr><th>보관 시각</th><th>종류</th><th>제목</th><th className="right">안건</th><th className="right">참석자</th><th></th></tr></thead>
              <tbody>
                {backups.map((b, i) => {
                  const x = normalizeRecord(b.value, id);
                  return (
                    <tr key={i}>
                      <td>{b.at ? new Date(b.at).toLocaleString("ko-KR") : "-"}</td>
                      <td>{SOURCE_LABEL[b.source] ?? b.source}</td>
                      <td>{x ? recordTitle(x) : "-"}</td>
                      <td className="right">{x?.agendas.filter((a) => a.title.trim()).length ?? 0}</td>
                      <td className="right">{x?.attendees.filter((a) => a.name || a.unit).length ?? 0}</td>
                      <td><button className="small" onClick={() => restore(b)} disabled={!x}>되돌리기</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      <div className="mt-tabs no-print">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {locked && tab !== "docs" && (
        <p className="warn no-print">
          확정된 회의 기록이라 수정할 수 없게 잠가 두었습니다. 고치려면 위의 ‘작성 중’을 누르세요.
        </p>
      )}
      {tab !== "docs" && (
        <fieldset className="rc-fs" disabled={locked}>
          {tab === "info" && <InfoTab r={r} up={up} setR={setR} />}
          {tab === "people" && <PeopleTab r={r} up={up} />}
          {tab === "agenda" && <AgendaTab r={r} up={up} />}
          {tab === "files" && <FilesTab r={r} up={up} />}
        </fieldset>
      )}
      {tab === "docs" && <DocsTab r={r} up={up} doc={doc} setDoc={setDoc} />}
    </>
  );
}

/* ---------- ① 기본정보 ---------- */

function InfoTab({ r, up, setR }: { r: MeetingRecord; up: Up; setR: (r: MeetingRecord) => void }) {
  const [msg, setMsg] = useState("");
  const t = (k: keyof MeetingRecord) => ({
    value: (r[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => up({ [k]: e.target.value } as Partial<MeetingRecord>),
  });
  const asm = isAssembly(r.kind);
  const setSigner = (i: number, v: string) => up({ signers: r.signers.map((s, j) => (j === i ? v : s)) });

  async function importMeeting() {
    if (!confirm("‘총회 준비’에 입력한 기본정보·안건·명부·투표·의사록 내용으로 이 기록을 덮어쓸까요? (지금 내용은 이전 버전에 보관됩니다)")) return;
    const { value, status } = await loadData<Meeting>("meeting:current");
    const m = normalizeMeeting(value);
    if (status !== "server" || !m) return setMsg("총회 준비 내용을 불러오지 못했습니다.");
    setR(fromMeeting(m, { ...r, attachments: r.attachments }));
    setMsg("총회 준비 내용을 가져왔습니다.");
  }

  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>회의 종류</h2>
        <div className="mt-seg">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={r.kind === k ? "on" : ""}
              onClick={() => {
                const emptyFiles = r.attachments.every((a) => !a.have && !a.note);
                up({ kind: k, ...(emptyFiles && isAssembly(k) !== isAssembly(r.kind) ? { attachments: defaultAttachments(k) } : {}) });
              }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="small muted">
          {asm
            ? "관리단집회 의사록은 의장이 작성하고, 의장과 집회에 출석한 구분소유자 2인 이상이 서명·날인해야 합니다. 관리인이 보관하며 이해관계인은 열람·등본 교부를 청구할 수 있습니다(법 제39조)."
            : r.kind === "committee"
              ? "관리위원회는 관리인의 사무 집행을 감독합니다(법 제26조의3). 회의 소집·의결 방법은 관리규약을 따르며, 규약에 정함이 없으면 재적 위원 과반수 찬성으로 의결하는 것을 기준으로 계산합니다."
              : "임원 회의·간담회·설명회 등 그 밖의 회의 기록에 씁니다."}
        </p>
        {asm && (
          <div className="row">
            <button type="button" className="ghost small" onClick={importMeeting}>‘총회 준비’ 내용 가져오기</button>
            {msg && <span className="small muted">{msg}</span>}
          </div>
        )}
      </div>

      <div className="card">
        <h2>회의 개요</h2>
        <div className="mt-form">
          <F label="회의 제목" hint={`비워 두면 ‘${recordTitle({ ...r, title: "" })}’`}><input {...t("title")} /></F>
          <F label="회차" hint="예: 제3차, 2026년 제1회"><input {...t("seq")} /></F>
          <F label="건물명"><input {...t("buildingName")} /></F>
          <F label="관리단 명칭"><input {...t("associationName")} /></F>
          <F label="회의 일자"><input type="date" {...t("date")} /></F>
          <F label="개회 시각"><input type="time" {...t("openTime")} /></F>
          <F label="폐회 시각"><input type="time" {...t("closeTime")} /></F>
          <F label="장소"><input {...t("place")} /></F>
          <F label="소집권자" hint={asm ? "예: 관리인 홍길동" : "예: 관리위원회 위원장 홍길동"}><input {...t("convener")} /></F>
          <F label="소집 통지일"><input type="date" {...t("noticeDate")} /></F>
          <F label="통지 방법" wide><input {...t("noticeMethod")} /></F>
        </div>
      </div>

      <div className="card">
        <h2>의장·서기·서명자</h2>
        <div className="mt-form">
          <F label="의장" hint={asm ? "관리인 또는 집회에서 선출된 사람" : "위원장"}><input {...t("chair")} /></F>
          <F label="서기"><input {...t("secretary")} /></F>
          {r.signers.map((s, i) => (
            <F key={i} label={`서명자 ${i + 1}`} hint={asm ? "출석한 구분소유자" : "출석 위원"}>
              <div className="row" style={{ margin: 0, flexWrap: "nowrap" }}>
                <input value={s} onChange={(e) => setSigner(i, e.target.value)} />
                <button type="button" className="ghost small danger" onClick={() => up({ signers: r.signers.filter((_, j) => j !== i) })}>✕</button>
              </div>
            </F>
          ))}
        </div>
        <button type="button" className="ghost small" onClick={() => up({ signers: [...r.signers, ""] })}>+ 서명자 추가</button>
      </div>

      <div className="card">
        <h2>내부 메모 <span className="small muted">(인쇄되지 않음)</span></h2>
        <textarea {...t("memo")} placeholder="진행 시 참고사항, 연락 기록 등" />
      </div>
    </div>
  );
}

/* ---------- ② 참석자 ---------- */

function parseAttendees(text: string, asm: boolean): Attendee[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(l.includes("\t") ? "\t" : ",").map((s) => s.trim()))
    .filter((c) => !/호실|성명/.test(c.join("")))
    .map((c) =>
      asm
        ? { ...emptyAttendee(), unit: c[0] ?? "", name: c[1] ?? "", area: c[2] ?? "" }
        : { ...emptyAttendee(), name: c[0] ?? "", role: c[1] ?? "" },
    );
}

function PeopleTab({ r, up }: { r: MeetingRecord; up: Up }) {
  const asm = isAssembly(r.kind);
  const [paste, setPaste] = useState("");
  const list = r.agendas.filter((a) => a.title.trim() && a.mode === "vote");
  const setA = (i: number, p: Partial<Attendee>) => up({ attendees: r.attendees.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const t = recordTotals(r);
  const at = recordAttendance(r);
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>{asm ? "구분소유자 명부와 출석" : r.kind === "committee" ? "위원 명단과 출석" : "참석자"}</h2>
        <div className="row">
          <label>{asm ? "전체 구분소유자 수" : r.kind === "committee" ? "재적 위원 수" : "대상 인원"}</label>
          <input className="num" value={r.totalHeads} onChange={(e) => up({ totalHeads: e.target.value })} placeholder={`명단 ${t.heads}명`} />
          {asm && (
            <>
              <label>전체 전유면적(㎡)</label>
              <input className="num" value={r.totalArea} onChange={(e) => up({ totalArea: e.target.value })} placeholder={`명단 ${fmtNum(t.area)}`} />
            </>
          )}
          <span className="small muted">비워 두면 아래 명단에서 계산합니다{asm ? " (불참자도 명단에 넣으면 정확합니다)" : ""}.</span>
        </div>
        <p className="small">
          출석 {at.all.heads}명 ({pct(at.all.heads, t.heads)}){asm && <> · 의결권 {fmtNum(at.all.area)}㎡ ({pct(at.all.area, t.area)})</>}
          {asm && <> · 직접 {at.present.heads} · 위임 {at.proxy.heads} · 서면 {at.written.heads}</>}
        </p>
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>엑셀에서 붙여넣기</summary>
          <p className="small muted">열 순서: {asm ? "호실, 성명, 전유면적" : "성명, 직책"} (탭 또는 쉼표 구분, 한 줄에 한 명)</p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} style={{ minHeight: 90 }} />
          <button
            type="button"
            onClick={() => {
              const rows = parseAttendees(paste, asm);
              if (rows.length) {
                up({ attendees: [...r.attendees.filter((a) => a.name || a.unit), ...rows] });
                setPaste("");
              }
            }}
          >
            명단에 추가
          </button>
        </details>
      </div>

      <div className="card">
        <div className="mt-scroll">
          <table className="table mt-owners" style={{ minWidth: asm ? 900 : 640 }}>
            <thead>
              <tr>
                {asm && <th className="w-unit">호실</th>}
                <th>{asm ? "구분소유자" : "성명"}</th>
                <th>{asm ? "비고" : "직책"}</th>
                {asm && <th className="w-area">전유면적(㎡)</th>}
                <th className="w-att">참석 방식</th>
                <th>대리인</th>
                {list.map((a, i) => <th key={a.id} className="w-vote" title={a.title}>제{i + 1}호</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {r.attendees.map((a, i) => (
                <tr key={a.id}>
                  {asm && <td><input value={a.unit} onChange={(e) => setA(i, { unit: e.target.value })} /></td>}
                  <td><input value={a.name} onChange={(e) => setA(i, { name: e.target.value })} /></td>
                  <td><input value={a.role} onChange={(e) => setA(i, { role: e.target.value })} placeholder={asm ? "" : "위원장·위원·감사"} /></td>
                  {asm && <td><input className="num" value={a.area} onChange={(e) => setA(i, { area: e.target.value })} inputMode="decimal" /></td>}
                  <td>
                    <select value={a.attend} onChange={(e) => setA(i, { attend: e.target.value as Attend })}>
                      {(Object.keys(ATTEND_LABEL) as Attend[]).filter((k) => asm || k !== "written").map((k) => (
                        <option key={k} value={k}>{ATTEND_LABEL[k]}</option>
                      ))}
                    </select>
                  </td>
                  <td><input value={a.proxyName} disabled={a.attend !== "proxy"} onChange={(e) => setA(i, { proxyName: e.target.value })} /></td>
                  {list.map((g) => (
                    <td key={g.id}>
                      <select
                        value={a.votes[g.id] ?? ""}
                        disabled={!a.attend}
                        onChange={(e) => setA(i, { votes: { ...a.votes, [g.id]: e.target.value as Vote } })}
                        className={a.votes[g.id] === "yes" ? "mt-yes" : a.votes[g.id] === "no" ? "mt-no" : ""}
                      >
                        {(Object.keys(VOTE_LABEL) as Vote[]).map((k) => <option key={k} value={k}>{VOTE_LABEL[k]}</option>)}
                      </select>
                    </td>
                  ))}
                  <td><button type="button" className="ghost small danger" onClick={() => up({ attendees: r.attendees.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => up({ attendees: [...r.attendees, emptyAttendee()] })}>+ {asm ? "호실" : "참석자"} 추가</button>
        </div>
        <p className="small muted">
          개인별 찬반을 입력하면 ‘③ 보고·안건·의결’에서 ‘명단 투표로 채우기’로 안건별 찬반 수를 계산할 수 있습니다. 찬반 수만 기록하려면 이 칸은 비워 두세요.
        </p>
      </div>
    </div>
  );
}

/* ---------- ③ 보고·안건·의결 ---------- */

function CountInput({ label, c, asm, onChange }: { label: string; c: Count; asm: boolean; onChange: (c: Count) => void }) {
  return (
    <div className="rc-count">
      <span>{label}</span>
      <input className="num" value={c.heads} onChange={(e) => onChange({ ...c, heads: e.target.value })} inputMode="numeric" placeholder="명" />
      {asm && <input className="num" value={c.area} onChange={(e) => onChange({ ...c, area: e.target.value })} inputMode="decimal" placeholder="㎡" />}
    </div>
  );
}

function AgendaTab({ r, up }: { r: MeetingRecord; up: Up }) {
  const asm = isAssembly(r.kind);
  const setG = (i: number, p: Partial<RecordAgenda>) => up({ agendas: r.agendas.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const move = (i: number, d: number) => {
    const list = [...r.agendas];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    up({ agendas: list });
  };
  let vn = 0;
  let rn = 0;
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>보고 사항</h2>
        <textarea value={r.reports} onChange={(e) => up({ reports: e.target.value })} placeholder="예: 전 회의 의결사항 이행 결과, 관리비 수입·지출 현황, 공사 진행 상황" />
      </div>

      {r.agendas.map((a, i) => {
        const j = judge(r, a);
        const label = a.mode === "vote" ? `제${++vn}호 의안` : `보고 ${++rn}`;
        const cv = countVotes(r, a.id);
        return (
          <div className="card mt-agenda" key={a.id}>
            <div className="top">
              <span className="no">{label}</span>
              <input placeholder={a.mode === "vote" ? "예: 관리인 선임의 건" : "예: 2026년 관리비 결산 보고"} value={a.title} onChange={(e) => setG(i, { title: e.target.value })} />
              <select value={a.mode} onChange={(e) => { const mode = e.target.value as RecordAgenda["mode"]; setG(i, { mode, result: mode === "report" ? "report" : "auto" }); }}>
                <option value="vote">의결 안건</option>
                <option value="report">보고 안건</option>
              </select>
              {asm && a.mode === "vote" && (
                <select value={a.type} onChange={(e) => setG(i, { type: e.target.value as ResolutionType })}>
                  {(Object.keys(RESOLUTION) as ResolutionType[]).map((k) => <option key={k} value={k}>{RESOLUTION[k].label}</option>)}
                </select>
              )}
              <button type="button" className="ghost small" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="ghost small" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="ghost small danger" onClick={() => up({ agendas: r.agendas.filter((_, k) => k !== i) })}>삭제</button>
            </div>
            <div className="mt-form" style={{ marginTop: 10 }}>
              <F label={a.mode === "vote" ? "심의 경과" : "보고 내용"} wide hint={a.mode === "vote" ? "비워 두면 ‘상정·설명·질의응답·표결’ 기본 문구를 씁니다. 주요 발언·질의응답을 적어 두면 분쟁 때 도움이 됩니다." : undefined}>
                <textarea value={a.discussion} onChange={(e) => setG(i, { discussion: e.target.value })} />
              </F>
              <F label={a.mode === "vote" ? "의결 내용(결정 사항)" : "질의·의견"} wide hint={a.mode === "vote" ? "예: 관리인으로 홍길동(301호)을 선임한다. 임기 2년." : undefined}>
                <textarea value={a.decision} onChange={(e) => setG(i, { decision: e.target.value })} />
              </F>
            </div>
            {a.mode === "vote" && (
              <>
                <div className="row rc-counts">
                  <CountInput label="찬성" c={a.yes} asm={asm} onChange={(c) => setG(i, { yes: c })} />
                  <CountInput label="반대" c={a.no} asm={asm} onChange={(c) => setG(i, { no: c })} />
                  <CountInput label="기권" c={a.abstain} asm={asm} onChange={(c) => setG(i, { abstain: c })} />
                  {cv.any && (
                    <button type="button" className="ghost small" onClick={() => setG(i, { yes: cv.yes, no: cv.no, abstain: cv.abstain })}>
                      명단 투표로 채우기
                    </button>
                  )}
                </div>
                <div className="row">
                  <label>결과</label>
                  <select value={a.result} onChange={(e) => setG(i, { result: e.target.value as ResultChoice })} style={{ width: "auto" }}>
                    <option value="auto">자동 판단{j.auto ? ` (${j.auto})` : ""}</option>
                    {(["pass", "fail", "hold"] as const).map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}
                  </select>
                  {j.label && <b className={j.label === "가결" ? "mt-yes" : j.label === "부결" ? "mt-no" : ""}>{j.label}</b>}
                  {j.why && <span className="small muted">{j.why}</span>}
                </div>
              </>
            )}
          </div>
        );
      })}
      <div className="row">
        <button type="button" className="ghost" onClick={() => up({ agendas: [...r.agendas, emptyRecordAgenda("vote")] })}>+ 의결 안건</button>
        <button type="button" className="ghost" onClick={() => up({ agendas: [...r.agendas, emptyRecordAgenda("report")] })}>+ 보고 안건</button>
      </div>

      <div className="card">
        <h2>기타 토의</h2>
        <textarea value={r.other} onChange={(e) => up({ other: e.target.value })} />
      </div>
    </div>
  );
}

/* ---------- ④ 첨부서류·후속조치 ---------- */

function FilesTab({ r, up }: { r: MeetingRecord; up: Up }) {
  const setD = (i: number, p: Partial<MeetingRecord["attachments"][number]>) => up({ attachments: r.attachments.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const setF = (i: number, p: Partial<MeetingRecord["followUps"][number]>) => up({ followUps: r.followUps.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const decided = r.agendas.filter((a) => a.mode === "vote" && a.title.trim() && judge(r, a).label === "가결");
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>첨부(보관) 서류</h2>
        <p className="small muted" style={{ marginTop: -6 }}>
          {minutesName(r.kind)} 원본과 함께 철해 둘 서류입니다. 받은 서류는 ‘확인’에 표시하세요. ‘⑤ 문서 만들기 › 회의 서류 보관 표지’로 목록을 인쇄할 수 있습니다.
        </p>
        <div className="mt-scroll">
          <table className="table mt-owners" style={{ minWidth: 640 }}>
            <thead><tr><th style={{ width: 60 }}>확인</th><th>서류명</th><th style={{ width: 80 }}>부수</th><th>비고</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {r.attachments.map((a, i) => (
                <tr key={a.id}>
                  <td className="center"><input type="checkbox" checked={a.have} onChange={(e) => setD(i, { have: e.target.checked })} /></td>
                  <td><input value={a.name} onChange={(e) => setD(i, { name: e.target.value })} /></td>
                  <td><input value={a.copies} onChange={(e) => setD(i, { copies: e.target.value })} /></td>
                  <td><input value={a.note} onChange={(e) => setD(i, { note: e.target.value })} /></td>
                  <td><button type="button" className="ghost small danger" onClick={() => up({ attachments: r.attachments.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => up({ attachments: [...r.attachments, emptyAttach()] })}>+ 서류 추가</button>
          <label>원본 보관 장소</label>
          <input value={r.storage} onChange={(e) => up({ storage: e.target.value })} />
          <label>결과 공고일</label>
          <input type="date" value={r.resultDate} onChange={(e) => up({ resultDate: e.target.value })} />
        </div>
      </div>

      <div className="card">
        <h2>후속조치(의결사항 이행)</h2>
        <div className="mt-scroll">
          <table className="table mt-owners" style={{ minWidth: 760 }}>
            <thead><tr><th style={{ width: 60 }}>완료</th><th>이행할 사항</th><th style={{ width: 130 }}>담당</th><th style={{ width: 150 }}>기한</th><th>비고</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {r.followUps.map((f, i) => (
                <tr key={f.id}>
                  <td className="center"><input type="checkbox" checked={f.done} onChange={(e) => setF(i, { done: e.target.checked })} /></td>
                  <td><input value={f.task} onChange={(e) => setF(i, { task: e.target.value })} /></td>
                  <td><input value={f.owner} onChange={(e) => setF(i, { owner: e.target.value })} /></td>
                  <td><input type="date" value={f.due} onChange={(e) => setF(i, { due: e.target.value })} /></td>
                  <td><input value={f.note} onChange={(e) => setF(i, { note: e.target.value })} /></td>
                  <td><button type="button" className="ghost small danger" onClick={() => up({ followUps: r.followUps.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => up({ followUps: [...r.followUps, emptyFollowUp()] })}>+ 후속조치 추가</button>
          {decided.length > 0 && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const have = new Set(r.followUps.map((f) => f.task));
                const add = decided.map((a) => a.title).filter((tt) => !have.has(`${tt} 이행`)).map((tt) => ({ ...emptyFollowUp(), task: `${tt} 이행` }));
                up({ followUps: [...r.followUps, ...add] });
              }}
            >
              가결 안건으로 채우기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ⑤ 문서 만들기 ---------- */

function download(name: string, html: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿", html], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function DocsTab({ r, up, doc, setDoc }: { r: MeetingRecord; up: Up; doc: RecordDocKey; setDoc: (k: RecordDocKey) => void }) {
  const [edit, setEdit] = useState(0);
  const paper = useRef<HTMLDivElement>(null);
  const info = RECORD_DOCS.find((d) => d.key === doc)!;
  const fileBase = `${recordTitle(r)}_${info.title(r)}`.replace(/[\\/:*?"<>|\s·]+/g, "_");
  const html = (forWord: boolean) =>
    `<!doctype html><html lang="ko"${forWord ? ` xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"` : ""}><head><meta charset="utf-8"><title>${fileBase}</title><style>${DOC_CSS}${RECORD_CSS}${
      forWord ? ".mt-page{width:auto;min-height:0;padding:0;box-shadow:none;margin:0;page-break-after:always}@page{size:21cm 29.7cm;margin:2cm 1.8cm}" : "body{background:#e5e7eb;padding:16px}"
    }</style></head><body>${paper.current?.innerHTML ?? ""}</body></html>`;
  const preview = useMemo(() => <RecordDocView r={r} docKey={doc} />, [r, doc]);
  const ver = useRef({ r, n: 0 });
  if (ver.current.r !== r) ver.current = { r, n: ver.current.n + 1 };

  const miss: string[] = [];
  if (doc === "minutes" || doc === "result") {
    if (!r.date) miss.push("회의 일자");
    if (!r.place) miss.push("장소");
    if (!r.agendas.some((a) => a.title.trim())) miss.push("안건");
  }
  if (doc === "minutes") {
    if (!r.chair) miss.push("의장");
    if (isAssembly(r.kind) && r.signers.filter((s) => s.trim()).length < 2) miss.push("서명할 출석 구분소유자 2인");
    if (r.agendas.some((a) => a.mode === "vote" && a.title.trim() && !a.yes.heads && !a.no.heads && a.result === "auto")) miss.push("안건별 찬반 수");
  }
  if (doc === "result" && !r.resultDate) miss.push("결과 공고일(④ 탭)");

  return (
    <div className="mt-docs">
      <div className="mt-doclist no-print">
        {RECORD_DOCS.map((d) => (
          <button key={d.key} className={doc === d.key ? "on" : ""} onClick={() => setDoc(d.key)}>
            {d.title(r)}
            <small>{d.desc}</small>
          </button>
        ))}
      </div>
      <div>
        <div className="card no-print" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginTop: 0 }}>
            <button onClick={() => window.print()}>인쇄 / PDF 저장</button>
            <button className="ghost" onClick={() => download(`${fileBase}.doc`, html(true), "application/msword")}>Word(.doc) 저장</button>
            <button className="ghost" onClick={() => setEdit((n) => n + 1)} title="문서에서 직접 고친 내용을 지우고 입력값으로 다시 만듭니다">입력값으로 다시 만들기</button>
            {r.status === "draft" && doc === "minutes" && (
              <button className="ghost" onClick={() => { if (confirm("서명·날인을 마친 회의록으로 확정할까요? 확정하면 실수로 고치지 않게 입력이 잠깁니다.")) up({ status: "final" }); }}>
                확정하기
              </button>
            )}
          </div>
          {miss.length > 0 ? (
            <p className="warn small" style={{ paddingLeft: 10 }}>아직 비어 있는 항목: {miss.join(", ")}. 빈칸은 밑줄로 표시되어 손으로 적을 수 있습니다.</p>
          ) : (
            <p className="small mt-yes" style={{ margin: "8px 0 0" }}>필수 항목이 모두 채워졌습니다.</p>
          )}
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            미리보기 문서를 클릭하면 바로 고칠 수 있습니다(인쇄·저장에만 반영되고 서버에는 저장되지 않습니다). 계속 남길 내용은 ①~④ 탭에 입력하세요. PDF는 인쇄 창에서 ‘PDF로 저장’을 고르세요.
          </p>
        </div>
        <style>{DOC_CSS + RECORD_CSS}</style>
        <div className="mt-paper">
          <div key={`${doc}-${edit}-${ver.current.n}`} ref={paper} contentEditable suppressContentEditableWarning spellCheck={false}>
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
