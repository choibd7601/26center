// 집합건물 회의관리: 관리단집회·관리위원회 등 회의 기록(회의록·참석자·의결·첨부서류·후속조치)
import {
  RESOLUTION,
  fmtNum,
  num,
  pct,
  uid,
  type Attend,
  type Meeting,
  type ResolutionType,
  type Vote,
} from "@/lib/meeting";

export type RecordKind = "regular" | "special" | "committee" | "other";
export type RecordStatus = "draft" | "final";
/** 안건 종류: 의결 안건 / 보고 안건 */
export type AgendaMode = "vote" | "report";
/** auto: 찬반 수로 판단, 그 밖에는 직접 지정 */
export type ResultChoice = "auto" | "pass" | "fail" | "hold" | "report";

export const KIND_LABEL: Record<RecordKind, string> = {
  regular: "정기 관리단집회",
  special: "임시 관리단집회",
  committee: "관리위원회",
  other: "기타 회의",
};
export const KIND_SHORT: Record<RecordKind, string> = {
  regular: "정기총회",
  special: "임시총회",
  committee: "관리위원회",
  other: "기타",
};
export const STATUS_LABEL: Record<RecordStatus, string> = { draft: "작성 중", final: "확정" };
export const RESULT_LABEL: Record<Exclude<ResultChoice, "auto">, string> = {
  pass: "가결",
  fail: "부결",
  hold: "보류",
  report: "보고 완료",
};

/** 회의 참석자(관리단집회: 구분소유자 / 관리위원회: 위원) */
export type Attendee = {
  id: string;
  unit: string; // 호실
  name: string;
  role: string; // 직책(위원장·위원·감사 등) 또는 비고
  area: string; // 전유면적(㎡), 관리단집회만
  attend: Attend; // "" = 불참
  proxyName: string;
  votes: Record<string, Vote>;
};

export type Count = { heads: string; area: string };

export type RecordAgenda = {
  id: string;
  title: string;
  mode: AgendaMode;
  type: ResolutionType; // 관리단집회 결의 요건
  discussion: string; // 심의 경과(제안 설명, 질의응답)
  decision: string; // 의결 내용(결정 사항)
  yes: Count;
  no: Count;
  abstain: Count;
  result: ResultChoice;
};

export type AttachDoc = { id: string; name: string; copies: string; note: string; have: boolean };
export type FollowUp = { id: string; task: string; owner: string; due: string; done: boolean; note: string };

export type MeetingRecord = {
  id: string;
  kind: RecordKind;
  status: RecordStatus;
  deleted: boolean;
  title: string; // 비우면 자동 제목
  seq: string; // 회차(예: 제3차)
  buildingName: string;
  associationName: string;
  date: string;
  openTime: string;
  closeTime: string;
  place: string;
  convener: string; // 소집권자
  noticeDate: string;
  noticeMethod: string;
  chair: string;
  secretary: string;
  signers: string[]; // 서명자(관리단집회: 출석 구분소유자 2인 / 관리위원회: 출석 위원)
  totalHeads: string; // 전체 구분소유자 수 / 재적 위원 수
  totalArea: string; // 전체 전유면적
  attendees: Attendee[];
  reports: string; // 보고 사항
  agendas: RecordAgenda[];
  other: string; // 기타 토의
  attachments: AttachDoc[];
  storage: string; // 원본 보관 장소
  followUps: FollowUp[];
  resultDate: string; // 결과 공고일
  memo: string; // 내부 메모(인쇄 안 함)
  createdAt: string;
};

export const emptyAttendee = (): Attendee => ({ id: uid(), unit: "", name: "", role: "", area: "", attend: "present", proxyName: "", votes: {} });
const c0 = (): Count => ({ heads: "", area: "" });
export const emptyRecordAgenda = (mode: AgendaMode = "vote"): RecordAgenda => ({
  id: uid(),
  title: "",
  mode,
  type: "ordinary",
  discussion: "",
  decision: "",
  yes: c0(),
  no: c0(),
  abstain: c0(),
  result: mode === "report" ? "report" : "auto",
});
export const emptyAttach = (name = "", copies = ""): AttachDoc => ({ id: uid(), name, copies, note: "", have: false });
export const emptyFollowUp = (): FollowUp => ({ id: uid(), task: "", owner: "", due: "", done: false, note: "" });

export const isAssembly = (k: RecordKind) => k === "regular" || k === "special";

/** 회의 종류별 기본 첨부(보관) 서류 */
export function defaultAttachments(kind: RecordKind): AttachDoc[] {
  if (isAssembly(kind))
    return [
      emptyAttach("소집통지서 사본 및 발송 증빙(내용증명 영수증 등)", "1"),
      emptyAttach("소집 공고문 게시 사진", "1"),
      emptyAttach("의안 설명서", "1"),
      emptyAttach("참석자 명부(서명부)", "1"),
      emptyAttach("위임장(신분증·인감증명서 사본 포함)", ""),
      emptyAttach("서면결의서", ""),
      emptyAttach("투표 집계표", "1"),
      emptyAttach("결과 공고문 및 게시 사진", "1"),
    ];
  if (kind === "committee")
    return [
      emptyAttach("회의 소집 통지(문자·공문)", "1"),
      emptyAttach("참석 위원 서명부", "1"),
      emptyAttach("안건 자료(견적서·계약서 등)", ""),
    ];
  return [emptyAttach("참석자 서명부", "1"), emptyAttach("회의 자료", "")];
}

export function newRecord(kind: RecordKind = "regular", id = makeId()): MeetingRecord {
  return {
    id,
    kind,
    status: "draft",
    deleted: false,
    title: "",
    seq: "",
    buildingName: "26센터",
    associationName: "26센터 관리단",
    date: "",
    openTime: "",
    closeTime: "",
    place: "",
    convener: "",
    noticeDate: "",
    noticeMethod: isAssembly(kind) ? "내용증명 우편 발송 및 건물 게시판 공고" : "",
    chair: "",
    secretary: "",
    signers: ["", ""],
    totalHeads: "",
    totalArea: "",
    attendees: [],
    reports: "",
    agendas: [emptyRecordAgenda()],
    other: "",
    attachments: defaultAttachments(kind),
    storage: "관리사무소",
    followUps: [],
    resultDate: "",
    memo: "",
    createdAt: new Date().toISOString(),
  };
}

export function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeRecord(r: Partial<MeetingRecord> | null | undefined, id?: string): MeetingRecord | null {
  if (!r) return null;
  const base = newRecord(r.kind ?? "regular", r.id ?? id ?? makeId());
  return {
    ...base,
    ...r,
    id: r.id ?? id ?? base.id,
    signers: Array.isArray(r.signers) ? r.signers : base.signers,
    attendees: (r.attendees ?? []).map((a) => ({ ...emptyAttendee(), ...a, votes: a.votes ?? {} })),
    agendas: (r.agendas ?? base.agendas).map((a) => {
      const e = emptyRecordAgenda(a.mode ?? "vote");
      return { ...e, ...a, yes: { ...c0(), ...a.yes }, no: { ...c0(), ...a.no }, abstain: { ...c0(), ...a.abstain } };
    }),
    attachments: (r.attachments ?? base.attachments).map((a) => ({ ...emptyAttach(), ...a })),
    followUps: (r.followUps ?? []).map((f) => ({ ...emptyFollowUp(), ...f })),
  };
}

export function recordTitle(r: Pick<MeetingRecord, "title" | "kind" | "date" | "seq">) {
  if (r.title.trim()) return r.title.trim();
  const y = r.date ? `${r.date.slice(0, 4)}년 ` : "";
  return `${y}${r.seq ? `${r.seq} ` : ""}${KIND_LABEL[r.kind]}`;
}

/** 문서 이름(의사록/회의록) */
export const minutesName = (k: RecordKind) => (isAssembly(k) ? "의사록" : "회의록");

/* ---------- 집계 ---------- */

const personKey = (a: Attendee) => a.name.replace(/\s/g, "") || `#${a.unit}`;

export function recordTotals(r: MeetingRecord) {
  const listed = r.attendees.filter((a) => a.name || a.unit);
  const heads = num(r.totalHeads) || new Set(listed.map(personKey)).size;
  const area = num(r.totalArea) || listed.reduce((s, a) => s + num(a.area), 0);
  return { heads, area };
}

export function recordAttendance(r: MeetingRecord) {
  const sets = { present: new Set<string>(), proxy: new Set<string>(), written: new Set<string>() };
  const area = { present: 0, proxy: 0, written: 0 };
  const all = new Set<string>();
  let allArea = 0;
  for (const a of r.attendees) {
    if (!a.attend || !(a.name || a.unit)) continue;
    sets[a.attend].add(personKey(a));
    area[a.attend] += num(a.area);
    all.add(personKey(a));
    allArea += num(a.area);
  }
  return {
    present: { heads: sets.present.size, area: area.present },
    proxy: { heads: sets.proxy.size, area: area.proxy },
    written: { heads: sets.written.size, area: area.written },
    all: { heads: all.size, area: allArea },
  };
}

/** 참석자 명부의 안건별 찬반을 센다 */
export function countVotes(r: MeetingRecord, agendaId: string) {
  const s = { yes: new Set<string>(), no: new Set<string>(), abstain: new Set<string>() };
  const area = { yes: 0, no: 0, abstain: 0 };
  let any = false;
  for (const a of r.attendees) {
    if (!a.attend) continue;
    const v = a.votes[agendaId];
    if (!v) continue;
    any = true;
    s[v].add(personKey(a));
    area[v] += num(a.area);
  }
  const f = (n: number) => (n ? String(Math.round(n * 100) / 100) : "0");
  return {
    any,
    yes: { heads: String(s.yes.size), area: f(area.yes) },
    no: { heads: String(s.no.size), area: f(area.no) },
    abstain: { heads: String(s.abstain.size), area: f(area.abstain) },
  };
}

/** 안건 결과 판단. 관리단집회: 전체 구분소유자·전체 면적 대비, 관리위원회: 재적 위원 과반수 찬성 */
export function judge(r: MeetingRecord, a: RecordAgenda): { label: string; auto: string; why: string } {
  const t = recordTotals(r);
  const yh = num(a.yes.heads);
  const ya = num(a.yes.area);
  const voted = yh + num(a.no.heads) + num(a.abstain.heads) > 0;
  let auto = "";
  let why = "";
  if (a.mode === "report") auto = "보고 완료";
  else if (voted) {
    if (isAssembly(r.kind)) {
      const rule = RESOLUTION[a.type];
      if (t.heads > 0) {
        const needH = rule.strict ? Math.floor(t.heads * rule.ratio) + 1 : Math.ceil(t.heads * rule.ratio - 1e-9);
        const hOk = yh >= needH;
        const aOk = t.area > 0 ? (rule.strict ? ya > t.area * rule.ratio + 1e-9 : ya >= t.area * rule.ratio - 1e-9) : true;
        auto = hOk && aOk ? "가결" : "부결";
        why = `${rule.text} 찬성 필요: 찬성 ${yh}/${t.heads}명(${pct(yh, t.heads)})${t.area > 0 ? `, ${fmtNum(ya)}/${fmtNum(t.area)}㎡(${pct(ya, t.area)})` : ""}`;
      } else why = "전체 구분소유자 수를 입력하면 가결 여부를 계산합니다.";
    } else if (r.kind === "committee") {
      if (t.heads > 0) {
        const need = Math.floor(t.heads / 2) + 1;
        auto = yh >= need ? "가결" : "부결";
        why = `재적 위원 ${t.heads}명의 과반수(${need}명) 찬성 필요: 찬성 ${yh}명`;
      } else why = "재적 위원 수를 입력하면 가결 여부를 계산합니다.";
    } else {
      const present = yh + num(a.no.heads) + num(a.abstain.heads);
      auto = yh > present / 2 ? "가결" : "부결";
      why = `출석 ${present}명 중 찬성 ${yh}명`;
    }
  }
  const label = a.result === "auto" ? auto : RESULT_LABEL[a.result];
  return { label, auto, why };
}

/* ---------- 총회 준비에서 가져오기 ---------- */

export function fromMeeting(m: Meeting, base: MeetingRecord): MeetingRecord {
  const ids = new Map<string, string>();
  const agendas = m.agendas
    .filter((a) => a.title.trim())
    .map((a) => {
      const na = { ...emptyRecordAgenda(), title: a.title, type: a.type, discussion: m.minutes.notes[a.id] ?? "" };
      ids.set(a.id, na.id);
      return na;
    });
  const attendees: Attendee[] = m.owners
    .filter((o) => o.unit || o.name)
    .map((o) => ({
      id: uid(),
      unit: o.unit,
      name: o.name,
      role: o.coOwners ? `공유: ${o.coOwners}` : "",
      area: o.area,
      attend: o.attend,
      proxyName: o.proxyName,
      votes: Object.fromEntries(Object.entries(o.votes).filter(([k]) => ids.has(k)).map(([k, v]) => [ids.get(k)!, v])),
    }));
  const r: MeetingRecord = {
    ...base,
    kind: m.kind,
    buildingName: m.buildingName || base.buildingName,
    associationName: m.associationName || base.associationName,
    date: m.date,
    openTime: m.minutes.openTime || m.time,
    closeTime: m.minutes.closeTime,
    place: m.place,
    convener: m.managerName ? `관리인 ${m.managerName}` : m.convenerRep,
    noticeDate: m.noticeDate,
    noticeMethod: m.noticeMethod,
    chair: m.minutes.chair,
    secretary: m.minutes.secretary,
    signers: [m.minutes.signer1, m.minutes.signer2],
    totalHeads: m.totalOwners,
    totalArea: m.totalArea,
    attendees,
    agendas: agendas.length ? agendas : base.agendas,
    other: m.minutes.other,
    resultDate: m.resultDate,
    attachments: base.attachments.length ? base.attachments : defaultAttachments(m.kind),
  };
  // 명부 투표가 있으면 찬반 수 채우기
  r.agendas = r.agendas.map((a) => {
    const c = countVotes(r, a.id);
    return c.any ? { ...a, yes: c.yes, no: c.no, abstain: c.abstain } : a;
  });
  return r;
}

/* ---------- 목록용 요약 ---------- */

export type RecordSummary = {
  id: string;
  kind: RecordKind;
  status: RecordStatus;
  deleted: boolean;
  title: string;
  date: string;
  place: string;
  agendas: string[];
  results: string[];
  openFollowUps: number;
  at: string;
};

export function summarize(r: MeetingRecord, at: string): RecordSummary {
  const list = r.agendas.filter((a) => a.title.trim());
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    deleted: r.deleted,
    title: recordTitle(r),
    date: r.date,
    place: r.place,
    agendas: list.map((a) => a.title),
    results: list.map((a) => judge(r, a).label),
    openFollowUps: r.followUps.filter((f) => f.task.trim() && !f.done).length,
    at,
  };
}
