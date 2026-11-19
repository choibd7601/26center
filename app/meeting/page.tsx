"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./meeting.css";
import { loadData, saveData, type SyncStatus } from "@/lib/store";
import SyncBadge from "@/components/SyncBadge";
import {
  ATTEND_LABEL,
  CONVENER_LABEL,
  KIND_LABEL,
  RESOLUTION,
  VOTE_LABEL,
  agendaNo,
  attendance,
  emptyAgenda,
  emptyOwner,
  fmtDate,
  fmtNum,
  meetingTitle,
  needed,
  neededArea,
  newMeeting,
  noticeDeadline,
  normalizeMeeting,
  num,
  parseOwners,
  passes,
  pct,
  scheduleChecks,
  tally,
  totals,
  toISO,
  addDays,
  parseDate,
  type Agenda,
  type Attend,
  type Convener,
  type Meeting,
  type MeetingKind,
  type Owner,
  type ResolutionType,
  type Vote,
} from "@/lib/meeting";
import { DOCS, PRACTICE_TIPS, buildSteps, type DocKey } from "@/components/meeting/guide";
import { DOC_CSS, DocView, PER_OWNER, missing } from "@/components/meeting/Docs";

const KEY = "meeting:current";
type Tab = "guide" | "info" | "owners" | "quorum" | "docs";
const TABS: [Tab, string][] = [
  ["guide", "① 절차 안내"],
  ["info", "② 기본정보·안건"],
  ["owners", "③ 명부·투표"],
  ["quorum", "④ 정족수"],
  ["docs", "⑤ 문서 만들기"],
];

const PRESETS: Record<MeetingKind, [string, ResolutionType][]> = {
  regular: [
    ["전년도 결산 승인의 건", "ordinary"],
    ["당해 연도 예산(관리비) 승인의 건", "ordinary"],
    ["관리인 선임의 건", "ordinary"],
    ["감사 선임의 건", "ordinary"],
    ["관리규약 개정의 건", "rules"],
  ],
  special: [
    ["관리인 해임의 건", "ordinary"],
    ["관리인 선임의 건", "ordinary"],
    ["체납 관리비 소송 제기의 건", "ordinary"],
    ["긴급 수선공사 시행의 건", "ordinary"],
    ["관리규약 개정의 건", "rules"],
    ["공용부분 변경의 건", "common"],
  ],
};

export default function MeetingPage() {
  const [m, setM] = useState<Meeting | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("guide");
  const [doc, setDoc] = useState<DocKey>("notice");
  const skipSave = useRef(true);
  const retry = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    loadData<Meeting>(KEY).then(({ value, status, fromServer }) => {
      if (!alive) return;
      skipSave.current = fromServer || value == null;
      setM(normalizeMeeting(value) ?? newMeeting());
      setStatus(status);
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!m) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(() => saveData(KEY, m).then(setStatus), 800);
    return () => clearTimeout(t);
  }, [m]);

  if (!m) return <p className="muted">불러오는 중…</p>;
  const up = (patch: Partial<Meeting>) => setM({ ...m, ...patch });
  const openDoc = (k: DocKey) => {
    setDoc(k);
    setTab("docs");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mt">
      <div className="mt-head no-print">
        <div>
          <h1>총회 준비</h1>
          <p className="muted small" style={{ margin: 0 }}>
            관리단집회(정기·임시총회) 절차 안내와 소집통지서·위임장·서면결의서·의사록 등 문서 작성
          </p>
        </div>
        <div className="row">
          <div className="mt-seg">
            {(["regular", "special"] as MeetingKind[]).map((k) => (
              <button key={k} className={m.kind === k ? "on" : ""} onClick={() => up({ kind: k })}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <SyncBadge status={status} onRetry={retry} />
          <button
            className="ghost small"
            onClick={() => {
              if (confirm("입력한 내용을 모두 지우고 새 총회 준비를 시작할까요? 명부는 남겨 둡니다.")) {
                const fresh = newMeeting(m.kind);
                setM({ ...fresh, owners: m.owners.map((o) => ({ ...o, attend: "" as Attend, proxyName: "", votes: {} })), buildingName: m.buildingName, buildingAddress: m.buildingAddress, associationName: m.associationName, managerName: m.managerName, managerPhone: m.managerPhone, contact: m.contact, place: m.place });
              }
            }}
          >
            새 총회 시작
          </button>
        </div>
      </div>

      <div className="mt-tabs no-print">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "guide" && <GuideTab m={m} up={up} openDoc={openDoc} goInfo={() => setTab("info")} />}
      {tab === "info" && <InfoTab m={m} up={up} />}
      {tab === "owners" && <OwnersTab m={m} up={up} />}
      {tab === "quorum" && <QuorumTab m={m} up={up} />}
      {tab === "docs" && <DocsTab m={m} up={up} doc={doc} setDoc={setDoc} />}
    </div>
  );
}

type TabProps = { m: Meeting; up: (p: Partial<Meeting>) => void };

/* ---------------- ① 절차 안내 ---------------- */

function ScheduleBox({ m }: { m: Meeting }) {
  const checks = scheduleChecks(m);
  return (
    <ul className="mt-checks">
      {checks.map((c, i) => (
        <li key={i} className={c.level}>
          {c.text}
        </li>
      ))}
    </ul>
  );
}

function GuideTab({ m, up, openDoc, goInfo }: TabProps & { openDoc: (k: DocKey) => void; goInfo: () => void }) {
  const steps = buildSteps(m);
  const ck = (id: string) => `${m.kind}:${id}`;
  const all = steps.flatMap((s) => s.procedures.map((_, i) => ck(`${s.id}:${i}`)));
  const done = all.filter((k) => m.checks[k]).length;
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>
          {meetingTitle(m)} · {CONVENER_LABEL[m.convener]}
        </h2>
        <p className="small muted" style={{ marginTop: -6 }}>
          {m.kind === "regular"
            ? "정기총회는 매년 회계연도 종료 후 3개월 이내에 관리인이 소집합니다(법 제32조)."
            : "임시총회는 필요할 때 수시로 엽니다. 정기총회와 가장 큰 차이는 누가 어떻게 소집하느냐입니다(법 제33조)."}{" "}
          집회 일자: <b>{m.date ? fmtDate(m.date) : "미정"}</b>
          {m.date && noticeDeadline(m) && (
            <>
              {" "}· 통지 도달 마감: <b>{fmtDate(noticeDeadline(m))}</b>
            </>
          )}{" "}
          <button className="ghost small" onClick={goInfo}>
            일자·소집 방식 입력
          </button>
        </p>
        <ScheduleBox m={m} />
        <div className="small muted" style={{ marginTop: 10 }}>
          진행 체크 {done}/{all.length}
          <div className="mt-progress">
            <div style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {steps.map((s) => (
        <div className="card mt-step" key={s.id}>
          <h2>{s.title}</h2>
          <div className="when">{s.when}</div>
          <h3>절차</h3>
          <ul className="proc">
            {s.procedures.map((p, i) => {
              const k = ck(`${s.id}:${i}`);
              return (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={!!m.checks[k]} onChange={(e) => up({ checks: { ...m.checks, [k]: e.target.checked } })} />
                    <span className={m.checks[k] ? "done" : ""}>{p}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {s.docs.length > 0 && (
            <>
              <h3>필요 문서</h3>
              <div className="mt-docbtns">
                {s.docs.map((k) => (
                  <button key={k} className="ghost small" onClick={() => openDoc(k)}>
                    📄 {DOCS.find((d) => d.key === k)?.title}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>주의사항</h3>
          <ul className="caution">
            {s.cautions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ))}

      <div className="card">
        <h2>실무 체크리스트 (놓치기 쉬운 포인트)</h2>
        <ul>
          {PRACTICE_TIPS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="small muted">
          이 안내는 「집합건물의 소유 및 관리에 관한 법률」의 일반 기준입니다. 관리규약이 소집 청구 비율·통지 기간·의장·성원 등을 달리 정했으면 규약을 따르고,
          다툼이 예상되면 변호사·법무사의 검토를 받으세요.
        </p>
      </div>
    </div>
  );
}

/* ---------------- ② 기본정보·안건 ---------------- */

function F({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`f ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function InfoTab({ m, up }: TabProps) {
  const t = (k: keyof Meeting) => ({
    value: (m[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => up({ [k]: e.target.value } as Partial<Meeting>),
  });
  const dl = noticeDeadline(m);
  const setAgenda = (i: number, p: Partial<Agenda>) => up({ agendas: m.agendas.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const move = (i: number, d: number) => {
    const list = [...m.agendas];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    up({ agendas: list });
  };
  const ownerSide = m.convener === "noManager" || m.convener === "court" || m.convener === "request";
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>건물·관리단</h2>
        <div className="mt-form">
          <F label="건물명"><input {...t("buildingName")} /></F>
          <F label="관리단 명칭"><input {...t("associationName")} /></F>
          <F label="건물 주소" wide><input {...t("buildingAddress")} /></F>
          <F label="관리인 성명" hint="관리인이 없으면 비워 두세요"><input {...t("managerName")} /></F>
          <F label="관리인 연락처"><input {...t("managerPhone")} /></F>
          <F label="문의처(통지서 표시)" hint="예: 관리사무소 02-000-0000"><input {...t("contact")} /></F>
        </div>
      </div>

      <div className="card">
        <h2>소집권자</h2>
        <div className="mt-form">
          <F label="소집 방식" wide>
            <select value={m.convener} onChange={(e) => up({ convener: e.target.value as Convener })}>
              {(Object.keys(CONVENER_LABEL) as Convener[]).map((c) => (
                <option key={c} value={c}>
                  {CONVENER_LABEL[c]}
                </option>
              ))}
            </select>
          </F>
          {ownerSide && (
            <>
              <F label="청구·동의 대표자 성명"><input {...t("convenerRep")} /></F>
              <F label="청구·동의 구분소유자 수" hint={totals(m).heads ? `전체 ${totals(m).heads}명의 1/5 = ${Math.ceil(totals(m).heads / 5)}명 이상 필요` : "명부를 입력하면 1/5 기준을 계산합니다"}>
                <input {...t("convenerCount")} inputMode="numeric" />
              </F>
            </>
          )}
          {(m.convener === "request" || m.convener === "court") && (
            <F label="소집 청구일"><input type="date" {...t("requestDate")} /></F>
          )}
          {m.convener === "court" && (
            <F label="법원 허가 (법원·사건번호)" hint="예: 서울중앙지방법원 2026비합000"><input {...t("courtPermit")} /></F>
          )}
        </div>
      </div>

      <div className="card">
        <h2>일시·장소·통지</h2>
        <div className="mt-form">
          <F label="회계연도(표시용)" hint="예: 2026 → '2026년도 정기 관리단집회'"><input {...t("year")} /></F>
          <F label="집회 일자"><input type="date" {...t("date")} /></F>
          <F label="시각"><input type="time" {...t("time")} /></F>
          <F label="장소" hint="건물 내 회의실 등 구체적으로"><input {...t("place")} /></F>
          {m.kind === "regular" && <F label="회계연도 종료일"><input type="date" {...t("fiscalEnd")} /></F>}
          <F label="규약상 통지 기간(일)" hint="법정 기본 7일(1주). 규약에 따로 정했으면 그 일수"><input {...t("noticeDays")} inputMode="numeric" /></F>
          <F label="통지 도달(발송) 예정일" hint={dl ? `늦어도 ${fmtDate(dl)}까지 도달` : undefined}>
            <input type="date" {...t("noticeDate")} />
          </F>
          <F label="서면결의서·위임장 제출기한" hint={m.date ? `예: 집회 전날 ${fmtDate(toISO(addDays(parseDate(m.date)!, -1)))}` : undefined}>
            <input type="date" {...t("submitDeadline")} />
          </F>
          <F label="제출처"><input {...t("submitPlace")} /></F>
          <F label="통지 방법" wide><input {...t("noticeMethod")} /></F>
        </div>
        <div style={{ marginTop: 12 }}>
          <ScheduleBox m={m} />
        </div>
      </div>

      <div className="card">
        <h2>안건 (회의 목적사항)</h2>
        <p className="small muted" style={{ marginTop: -6 }}>
          “기타 안건”처럼 포괄적으로 적지 말고 “관리인 선임의 건”처럼 구체적으로 적으세요. 통지하지 않은 안건은 결의할 수 없습니다.
        </p>
        <div className="row">
          <span className="small muted">자주 쓰는 안건:</span>
          {PRESETS[m.kind].map(([title, type]) => (
            <button
              key={title}
              className="ghost small"
              onClick={() => {
                const list = m.agendas.filter((a) => a.title.trim() || a.reason || a.content);
                up({ agendas: [...list, { ...emptyAgenda(), title, type }] });
              }}
            >
              + {title}
            </button>
          ))}
        </div>
        {m.agendas.map((a, i) => (
          <div className="mt-agenda" key={a.id}>
            <div className="top">
              <span className="no">{agendaNo(i)}</span>
              <input placeholder="예: 관리인 선임의 건" value={a.title} onChange={(e) => setAgenda(i, { title: e.target.value })} />
              <select value={a.type} onChange={(e) => setAgenda(i, { type: e.target.value as ResolutionType })}>
                {(Object.keys(RESOLUTION) as ResolutionType[]).map((r) => (
                  <option key={r} value={r}>
                    {RESOLUTION[r].label}
                  </option>
                ))}
              </select>
              <button className="ghost small" onClick={() => move(i, -1)} title="위로">↑</button>
              <button className="ghost small" onClick={() => move(i, 1)} title="아래로">↓</button>
              <button className="ghost small danger" onClick={() => up({ agendas: m.agendas.filter((_, j) => j !== i) })}>삭제</button>
            </div>
            <div className="small muted" style={{ margin: "4px 0 8px" }}>
              해당 예: {RESOLUTION[a.type].examples}
            </div>
            <div className="mt-form">
              <F label="제안 이유"><textarea value={a.reason} onChange={(e) => setAgenda(i, { reason: e.target.value })} /></F>
              <F
                label={a.type === "rules" ? "의안의 요령 (규약 개정 내용 · 필수)" : "주요 내용"}
                hint={a.type === "rules" ? "현행/개정안 대비 내용을 적으세요. 통지서와 함께 보내야 합니다." : "후보자 약력, 공사 내용·금액, 예산 개요 등"}
              >
                <textarea value={a.content} onChange={(e) => setAgenda(i, { content: e.target.value })} />
              </F>
              <F label="첨부 자료" wide hint="예: 견적 비교표 1부, 후보자 이력서 1부">
                <input value={a.attachments} onChange={(e) => setAgenda(i, { attachments: e.target.value })} />
              </F>
            </div>
          </div>
        ))}
        <button className="ghost" onClick={() => up({ agendas: [...m.agendas, emptyAgenda()] })}>
          + 안건 추가
        </button>
      </div>
    </div>
  );
}

/* ---------------- ③ 명부·투표 ---------------- */

function OwnersTab({ m, up }: TabProps) {
  const [paste, setPaste] = useState("");
  const list = m.agendas.filter((a) => a.title.trim());
  const setOwner = (i: number, p: Partial<Owner>) => up({ owners: m.owners.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  const t = totals(m);
  const at = attendance(m);
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>구분소유자 명부</h2>
        <p className="small muted" style={{ marginTop: -6 }}>
          등기부등본(표제부·갑구) 기준으로 호실·구분소유자·전유면적을 입력하세요. 공동명의 호실은 지정 대표자를 ‘구분소유자’에, 나머지를 ‘다른 공유자’에 적습니다.
          한 사람이 여러 호실을 가지면 사람 수는 1명, 면적은 합산합니다(성명이 같으면 같은 사람으로 셉니다).
        </p>
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>엑셀에서 붙여넣기</summary>
          <p className="small muted">열 순서: 호실, 성명, 전유면적, 연락처, 주소, 다른 공유자 (탭 또는 쉼표 구분, 한 줄에 한 호실)</p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"101\t홍길동\t45.2\t010-0000-0000\n102\t김철수\t38.5"} style={{ minHeight: 100 }} />
          <div className="row">
            <button onClick={() => { const rows = parseOwners(paste); if (rows.length) { up({ owners: [...m.owners.filter((o) => o.unit || o.name), ...rows] }); setPaste(""); } }}>
              명부에 추가
            </button>
            <button className="ghost" onClick={() => { const rows = parseOwners(paste); if (rows.length && confirm(`기존 명부를 지우고 ${rows.length}개 호실로 바꿀까요?`)) { up({ owners: rows }); setPaste(""); } }}>
              명부 바꾸기
            </button>
          </div>
        </details>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>명부 · 출석 · 안건별 투표</h2>
          <span className="small muted">
            전체 {t.heads}명 / {fmtNum(t.area)}㎡ · 출석(위임·서면 포함) {at.all.heads}명 ({pct(at.all.heads, t.heads)}) / {fmtNum(at.all.area)}㎡ ({pct(at.all.area, t.area)})
          </span>
        </div>
        <div className="mt-scroll" style={{ marginTop: 8 }}>
          <table className="table mt-owners">
            <thead>
              <tr>
                <th className="w-unit">호실</th>
                <th>구분소유자</th>
                <th>다른 공유자</th>
                <th className="w-area">전유면적(㎡)</th>
                <th>연락처</th>
                <th className="w-att">참석 방식</th>
                <th>대리인</th>
                {list.map((a, i) => (
                  <th key={a.id} className="w-vote" title={a.title}>
                    제{i + 1}호
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {m.owners.map((o, i) => (
                <tr key={o.id}>
                  <td><input value={o.unit} onChange={(e) => setOwner(i, { unit: e.target.value })} /></td>
                  <td><input value={o.name} onChange={(e) => setOwner(i, { name: e.target.value })} /></td>
                  <td><input value={o.coOwners} onChange={(e) => setOwner(i, { coOwners: e.target.value })} placeholder="쉼표로 구분" /></td>
                  <td><input className="num" value={o.area} onChange={(e) => setOwner(i, { area: e.target.value })} inputMode="decimal" /></td>
                  <td><input value={o.phone} onChange={(e) => setOwner(i, { phone: e.target.value })} /></td>
                  <td>
                    <select value={o.attend} onChange={(e) => setOwner(i, { attend: e.target.value as Attend })}>
                      {(Object.keys(ATTEND_LABEL) as Attend[]).map((k) => (
                        <option key={k} value={k}>{ATTEND_LABEL[k]}</option>
                      ))}
                    </select>
                  </td>
                  <td><input value={o.proxyName} disabled={o.attend !== "proxy"} onChange={(e) => setOwner(i, { proxyName: e.target.value })} /></td>
                  {list.map((a) => (
                    <td key={a.id}>
                      <select
                        value={o.votes[a.id] ?? ""}
                        disabled={!o.attend}
                        onChange={(e) => setOwner(i, { votes: { ...o.votes, [a.id]: e.target.value as Vote } })}
                        className={o.votes[a.id] === "yes" ? "mt-yes" : o.votes[a.id] === "no" ? "mt-no" : ""}
                      >
                        {(Object.keys(VOTE_LABEL) as Vote[]).map((k) => (
                          <option key={k} value={k}>{VOTE_LABEL[k]}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td><button className="ghost small danger" onClick={() => up({ owners: m.owners.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => up({ owners: [...m.owners, emptyOwner()] })}>+ 호실 추가</button>
          {list.length > 0 && (
            <button
              className="ghost"
              onClick={() => up({ owners: m.owners.map((o) => (o.attend ? { ...o, votes: Object.fromEntries(list.map((a) => [a.id, o.votes[a.id] || "yes"])) } : o)) })}
            >
              출석자 빈 투표를 ‘찬성’으로 채우기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ④ 정족수 ---------------- */

function QuorumTab({ m, up }: TabProps) {
  const t = totals(m);
  const list = m.agendas.filter((a) => a.title.trim());
  const [calc, setCalc] = useState({ type: "ordinary" as ResolutionType, heads: "", area: "" });
  const cp = passes(num(calc.heads), num(calc.area), t, calc.type);
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <div className="card">
        <h2>정족수는 이렇게 계산합니다</h2>
        <ol className="small">
          <li><b>두 요건을 모두</b> 채워야 가결입니다: ① 구분소유자 수(사람 수) ② 의결권(전유면적 비율, 법 제37조).</li>
          <li>분모는 <b>출석자가 아니라 전체</b> 구분소유자 수·전체 전유면적입니다. 직접 참석·위임·서면결의를 모두 더해 셉니다.</li>
          <li>한 사람이 여러 호실을 가져도 사람 수는 1명, 면적은 합산합니다. 공유 호실은 대표자 1인이 행사합니다.</li>
          <li>예: 10명 중 6명이 찬성해도 그 6명의 면적 합이 전체의 50% 이하라면 보통결의는 부결입니다.</li>
        </ol>
        <div className="row">
          <label>전체 구분소유자 수</label>
          <input className="num" value={m.totalOwners} onChange={(e) => up({ totalOwners: e.target.value })} placeholder={t.fromList ? `명부 ${t.heads}명` : "명"} />
          <label>전체 전유면적(㎡)</label>
          <input className="num" value={m.totalArea} onChange={(e) => up({ totalArea: e.target.value })} placeholder={t.fromList ? `명부 ${fmtNum(t.area)}` : "㎡"} />
          <span className="small muted">비워 두면 명부에서 계산합니다.</span>
        </div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr><th>결의 구분</th><th>요건</th><th>해당 안건 예</th><th className="right">필요 찬성 수</th><th className="right">필요 찬성 면적</th></tr>
          </thead>
          <tbody>
            {(Object.keys(RESOLUTION) as ResolutionType[]).map((r) => (
              <tr key={r}>
                <td>{RESOLUTION[r].label}</td>
                <td className="small">{RESOLUTION[r].text}</td>
                <td className="small muted">{RESOLUTION[r].examples}</td>
                <td className="right">{t.heads ? `${needed(t.heads, r)}명 이상` : "-"}</td>
                <td className="right">{t.area ? `${fmtNum(neededArea(t.area, r))}㎡ ${RESOLUTION[r].strict ? "초과" : "이상"}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">공용부분 변경은 2021.2.5. 시행 개정법으로 각 3분의 2 이상으로 완화되었습니다. 관리규약과 최신 법령(국가법령정보센터)을 함께 확인하세요.</p>
      </div>

      <div className="card">
        <h2>안건별 결과 (명부 투표 기준)</h2>
        {!m.owners.some((o) => o.attend) ? (
          <p className="muted">‘③ 명부·투표’ 탭에서 참석 방식과 안건별 찬반을 입력하면 자동으로 집계합니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>의안</th><th>요건</th><th className="right">찬성 수</th><th className="right">찬성 면적</th><th className="right">반대</th><th className="right">기권</th><th>결과</th></tr>
            </thead>
            <tbody>
              {list.map((a, i) => {
                const y = tally(m, a.id);
                const p = passes(y.yes.heads, y.yes.area, t, a.type);
                return (
                  <tr key={a.id}>
                    <td>{agendaNo(i)}: {a.title}</td>
                    <td className="small">{RESOLUTION[a.type].short}</td>
                    <td className={`right ${p.hOk ? "mt-yes" : "mt-no"}`}>{y.yes.heads}/{t.heads}명 ({pct(y.yes.heads, t.heads)})</td>
                    <td className={`right ${p.aOk ? "mt-yes" : "mt-no"}`}>{fmtNum(y.yes.area)}㎡ ({pct(y.yes.area, t.area)})</td>
                    <td className="right">{y.no.heads}명</td>
                    <td className="right">{y.abstain.heads}명</td>
                    <td className={p.ok ? "mt-yes" : "mt-no"}>{p.ok ? "가결" : "부결"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>간이 계산기</h2>
        <div className="row">
          <select value={calc.type} onChange={(e) => setCalc({ ...calc, type: e.target.value as ResolutionType })} style={{ width: "auto" }}>
            {(Object.keys(RESOLUTION) as ResolutionType[]).map((r) => (
              <option key={r} value={r}>{RESOLUTION[r].label}</option>
            ))}
          </select>
          <label>찬성 구분소유자 수</label>
          <input className="num" value={calc.heads} onChange={(e) => setCalc({ ...calc, heads: e.target.value })} />
          <label>찬성 면적(㎡)</label>
          <input className="num" value={calc.area} onChange={(e) => setCalc({ ...calc, area: e.target.value })} />
        </div>
        {t.heads > 0 && t.area > 0 ? (
          <p>
            사람 수 {num(calc.heads)}/{t.heads}명 ({pct(num(calc.heads), t.heads)}) <b className={cp.hOk ? "mt-yes" : "mt-no"}>{cp.hOk ? "충족" : "미달"}</b> · 면적{" "}
            {fmtNum(num(calc.area))}/{fmtNum(t.area)}㎡ ({pct(num(calc.area), t.area)}) <b className={cp.aOk ? "mt-yes" : "mt-no"}>{cp.aOk ? "충족" : "미달"}</b> →{" "}
            <b className={cp.ok ? "mt-yes" : "mt-no"}>{cp.ok ? "가결" : "부결"}</b>
          </p>
        ) : (
          <p className="muted">전체 구분소유자 수와 전체 전유면적을 먼저 입력하세요.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- ⑤ 문서 만들기 ---------------- */

function download(name: string, html: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿", html], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function DocsTab({ m, up, doc, setDoc }: TabProps & { doc: DocKey; setDoc: (k: DocKey) => void }) {
  const [perOwner, setPerOwner] = useState(false);
  const [edit, setEdit] = useState(0);
  const paper = useRef<HTMLDivElement>(null);
  const info = DOCS.find((d) => d.key === doc)!;
  const miss = missing(m, doc);
  const hasOwners = m.owners.some((o) => o.unit || o.name);
  const fileBase = `${meetingTitle(m)}_${info.title}`.replace(/[\\/:*?"<>|\s·]+/g, "_");
  const mm = m.minutes;
  const setMin = (p: Partial<Meeting["minutes"]>) => up({ minutes: { ...mm, ...p } });
  const list = m.agendas.filter((a) => a.title.trim());

  const html = (forWord: boolean) =>
    `<!doctype html><html lang="ko"${forWord ? ` xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"` : ""}><head><meta charset="utf-8"><title>${fileBase}</title><style>${DOC_CSS}${
      forWord ? ".mt-page{width:auto;min-height:0;padding:0;box-shadow:none;margin:0;page-break-after:always}@page{size:21cm 29.7cm;margin:2cm 1.8cm}" : "body{background:#e5e7eb;padding:16px}"
    }</style></head><body>${paper.current?.innerHTML ?? ""}</body></html>`;

  const preview = useMemo(() => <DocView m={m} docKey={doc} perOwner={perOwner} />, [m, doc, perOwner]);
  // 입력값이 바뀌면 문서를 새로 그린다(문서에서 직접 고친 내용은 지워짐)
  const ver = useRef({ m, n: 0 });
  if (ver.current.m !== m) ver.current = { m, n: ver.current.n + 1 };

  return (
    <div className="mt-docs">
      <div className="mt-doclist no-print">
        {DOCS.map((d) => (
          <button key={d.key} className={doc === d.key ? "on" : ""} onClick={() => setDoc(d.key)}>
            {d.title}
            <small>{d.desc}</small>
          </button>
        ))}
      </div>
      <div>
        <div className="card no-print" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginTop: 0 }}>
            <button onClick={() => window.print()}>인쇄 / PDF 저장</button>
            <button className="ghost" onClick={() => download(`${fileBase}.doc`, html(true), "application/msword")}>Word(.doc) 저장</button>
            <button className="ghost" onClick={() => download(`${fileBase}.html`, html(false), "text/html;charset=utf-8")}>HTML 저장</button>
            <button className="ghost" onClick={() => setEdit((n) => n + 1)} title="문서에서 직접 고친 내용을 지우고 입력값으로 다시 만듭니다">
              입력값으로 다시 만들기
            </button>
            {PER_OWNER.includes(doc) && (
              <label className="small" style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={perOwner} disabled={!hasOwners} onChange={(e) => setPerOwner(e.target.checked)} />{" "}
                명부의 구분소유자별로 채워서 {doc === "rep" ? "(공유 호실만) " : ""}출력{!hasOwners && " (명부 입력 필요)"}
              </label>
            )}
          </div>
          {miss.length > 0 ? (
            <p className="warn small" style={{ paddingLeft: 10 }}>
              아직 비어 있는 항목: {miss.join(", ")}. 빈칸은 밑줄로 표시되어 손으로 적을 수 있습니다.
            </p>
          ) : (
            <p className="small mt-yes" style={{ margin: "8px 0 0" }}>필수 항목이 모두 채워졌습니다.</p>
          )}
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            미리보기 문서를 클릭하면 바로 고칠 수 있습니다(인쇄·저장에 반영되지만 서버에는 저장되지 않고, 입력값을 바꾸면 다시 만들어집니다). PDF는 인쇄 창에서 ‘PDF로 저장’을 고르세요.
          </p>

          {doc === "minutes" && (
            <div className="mt-form" style={{ marginTop: 12 }}>
              <F label="개회 시각"><input type="time" value={mm.openTime} onChange={(e) => setMin({ openTime: e.target.value })} /></F>
              <F label="폐회 시각"><input type="time" value={mm.closeTime} onChange={(e) => setMin({ closeTime: e.target.value })} /></F>
              <F label="의장" hint={m.convener === "manager" || m.convener === "request" ? "관리인이 소집했으면 관리인" : "소집 구분소유자 중 연장자 또는 선출된 사람"}>
                <input value={mm.chair} onChange={(e) => setMin({ chair: e.target.value })} />
              </F>
              <F label="서기"><input value={mm.secretary} onChange={(e) => setMin({ secretary: e.target.value })} /></F>
              <F label="서명할 출석 구분소유자 1"><input value={mm.signer1} onChange={(e) => setMin({ signer1: e.target.value })} /></F>
              <F label="서명할 출석 구분소유자 2"><input value={mm.signer2} onChange={(e) => setMin({ signer2: e.target.value })} /></F>
              {list.map((a, i) => (
                <F key={a.id} label={`${agendaNo(i)} 심의 경과`} wide hint="비워 두면 기본 문구(상정·설명·질의응답·표결)를 씁니다">
                  <textarea value={mm.notes[a.id] ?? ""} onChange={(e) => setMin({ notes: { ...mm.notes, [a.id]: e.target.value } })} />
                </F>
              ))}
              <F label="기타 경과" wide><textarea value={mm.other} onChange={(e) => setMin({ other: e.target.value })} /></F>
            </div>
          )}
          {doc === "result" && (
            <div className="mt-form" style={{ marginTop: 12 }}>
              <F label="결과 공고일"><input type="date" value={m.resultDate} onChange={(e) => up({ resultDate: e.target.value })} /></F>
            </div>
          )}
          {(doc === "minutes" || doc === "result") && (
            <p className="small muted" style={{ margin: "8px 0 0" }}>표결 결과는 ‘③ 명부·투표’에 입력한 참석 방식과 찬반으로 자동 집계됩니다.</p>
          )}
        </div>

        <style>{DOC_CSS}</style>
        <div className="mt-paper">
          <div key={`${doc}-${perOwner}-${edit}-${ver.current.n}`} ref={paper} contentEditable suppressContentEditableWarning spellCheck={false}>
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
