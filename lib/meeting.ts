// 관리단집회(총회) 준비: 자료형, 날짜·기한 계산, 의결 정족수 계산

export type MeetingKind = "regular" | "special";
/** manager: 관리인 직권 소집, request: 구분소유자 1/5 청구 → 관리인 소집,
 *  noManager: 관리인이 없어 구분소유자 1/5이 직접 소집, court: 관리인 불응 → 법원 허가 소집 */
export type Convener = "manager" | "request" | "noManager" | "court";
export type ResolutionType = "ordinary" | "common" | "rules" | "super";
export type Attend = "" | "present" | "proxy" | "written";
export type Vote = "" | "yes" | "no" | "abstain";

export type Agenda = {
  id: string;
  title: string;
  type: ResolutionType;
  reason: string; // 제안 이유
  content: string; // 주요 내용 / 의안의 요령(규약 개정안)
  attachments: string; // 첨부 자료
};

export type Owner = {
  id: string;
  unit: string; // 호실
  name: string; // 구분소유자(공유 시 대표자)
  coOwners: string; // 다른 공유자
  area: string; // 전유면적(㎡)
  phone: string;
  address: string;
  attend: Attend;
  proxyName: string; // 대리인
  votes: Record<string, Vote>;
};

export type Minutes = {
  openTime: string;
  closeTime: string;
  chair: string;
  secretary: string;
  signer1: string;
  signer2: string;
  notes: Record<string, string>; // 안건별 심의 경과
  other: string; // 기타 경과
};

export type Meeting = {
  kind: MeetingKind;
  convener: Convener;
  buildingName: string;
  buildingAddress: string;
  associationName: string;
  year: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  place: string;
  managerName: string;
  managerPhone: string;
  convenerRep: string; // 소집 청구·동의 대표자
  convenerCount: string; // 청구·동의 구분소유자 수
  requestDate: string; // 소집 청구일
  courtPermit: string; // 법원 허가 사건번호 등
  fiscalEnd: string; // 회계연도 종료일(정기)
  noticeDays: string; // 규약상 통지 기간(일)
  noticeDate: string; // 통지 도달(발송) 예정일
  noticeMethod: string;
  submitDeadline: string; // 서면결의서·위임장 제출기한
  submitTime: string; // 제출 마감 시각
  postEnd: string; // 공고 게시 종료일(비우면 집회일)
  submitPlace: string;
  contact: string;
  totalOwners: string; // 명부가 없을 때 직접 입력
  totalArea: string;
  agendas: Agenda[];
  owners: Owner[];
  minutes: Minutes;
  resultDate: string; // 결과 공고일
  checks: Record<string, boolean>;
};

export const KIND_LABEL: Record<MeetingKind, string> = { regular: "정기총회", special: "임시총회" };
export const KIND_FORMAL: Record<MeetingKind, string> = { regular: "정기 관리단집회", special: "임시 관리단집회" };

export const CONVENER_LABEL: Record<Convener, string> = {
  manager: "관리인이 직권으로 소집",
  request: "구분소유자 1/5 이상 청구 → 관리인이 소집",
  noManager: "관리인이 없어 구분소유자 1/5 이상이 직접 소집",
  court: "관리인 불응 → 법원 허가를 받아 청구인이 소집",
};

export const RESOLUTION: Record<
  ResolutionType,
  { label: string; short: string; ratio: number; strict: boolean; text: string; examples: string }
> = {
  ordinary: {
    label: "보통결의 (각 과반수)",
    short: "과반수",
    ratio: 1 / 2,
    strict: true,
    text: "구분소유자 및 의결권의 각 과반수",
    examples: "관리인 선임·해임, 관리비 부과·징수, 공용부분 관리, 소송 제기, 일반 수선",
  },
  common: {
    label: "공용부분 변경 (각 3분의 2 이상)",
    short: "3분의 2 이상",
    ratio: 2 / 3,
    strict: false,
    text: "구분소유자 및 의결권의 각 3분의 2 이상",
    examples: "공용부분의 변경(법 제15조, 2021.2.5. 시행 개정법 기준)",
  },
  rules: {
    label: "특별결의 (각 4분의 3 이상)",
    short: "4분의 3 이상",
    ratio: 3 / 4,
    strict: false,
    text: "구분소유자 및 의결권의 각 4분의 3 이상",
    examples: "관리규약 설정·변경·폐지, 공용부분의 중대한 변경",
  },
  super: {
    label: "재건축 등 (각 5분의 4 이상)",
    short: "5분의 4 이상",
    ratio: 4 / 5,
    strict: false,
    text: "구분소유자 및 의결권의 각 5분의 4 이상",
    examples: "재건축 결의, 권리변동 있는 공용부분 변경, 집회 없는 서면결의(법 제41조)",
  },
};

export const ATTEND_LABEL: Record<Attend, string> = { "": "불참", present: "직접 참석", proxy: "위임(대리)", written: "서면결의" };
export const VOTE_LABEL: Record<Vote, string> = { "": "-", yes: "찬성", no: "반대", abstain: "기권" };

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const emptyAgenda = (): Agenda => ({ id: uid(), title: "", type: "ordinary", reason: "", content: "", attachments: "" });
export const emptyOwner = (): Owner => ({
  id: uid(),
  unit: "",
  name: "",
  coOwners: "",
  area: "",
  phone: "",
  address: "",
  attend: "",
  proxyName: "",
  votes: {},
});

export function newMeeting(kind: MeetingKind = "regular"): Meeting {
  const y = new Date().getFullYear();
  return {
    kind,
    convener: "manager",
    buildingName: "26센터",
    buildingAddress: "",
    associationName: "26센터 관리단",
    year: String(kind === "regular" ? y : y),
    date: "",
    time: "19:00",
    place: "",
    managerName: "",
    managerPhone: "",
    convenerRep: "",
    convenerCount: "",
    requestDate: "",
    courtPermit: "",
    fiscalEnd: `${y - 1}-12-31`,
    noticeDays: "7",
    noticeDate: "",
    noticeMethod: "내용증명 우편 발송 및 건물 게시판·엘리베이터 공고",
    submitDeadline: "",
    submitTime: "18:00",
    postEnd: "",
    submitPlace: "관리사무소",
    contact: "",
    totalOwners: "",
    totalArea: "",
    agendas: [emptyAgenda()],
    owners: [],
    minutes: { openTime: "", closeTime: "", chair: "", secretary: "", signer1: "", signer2: "", notes: {}, other: "" },
    resultDate: "",
    checks: {},
  };
}

export function normalizeMeeting(m: Partial<Meeting> | null): Meeting | null {
  if (!m) return null;
  const base = newMeeting(m.kind ?? "regular");
  return {
    ...base,
    ...m,
    agendas: (m.agendas ?? base.agendas).map((a) => ({ ...emptyAgenda(), ...a })),
    owners: (m.owners ?? []).map((o) => ({ ...emptyOwner(), ...o, votes: o.votes ?? {} })),
    minutes: { ...base.minutes, ...(m.minutes ?? {}), notes: m.minutes?.notes ?? {} },
    checks: m.checks ?? {},
  };
}

/* ---------- 날짜 ---------- */

export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
export function addMonths(d: Date, n: number) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
}
export function diffDays(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
const WEEK = "일월화수목금토";
export function fmtDate(d: Date | string | null, withWeek = true) {
  const x = typeof d === "string" ? parseDate(d) : d;
  if (!x) return "";
  return `${x.getFullYear()}년 ${x.getMonth() + 1}월 ${x.getDate()}일${withWeek ? `(${WEEK[x.getDay()]})` : ""}`;
}
export function fmtTime(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!m) return t ?? "";
  const h = Number(m[1]);
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}시${m[2] !== "00" ? ` ${Number(m[2])}분` : ""}`;
}

export type Check = { level: "ok" | "warn" | "bad" | "info"; text: string };

/**
 * 통지 기한: "집회일 1주일 전"은 집회 전날부터 거꾸로 7일을 세므로(민법 제157조 초일 불산입),
 * 늦어도 집회일 8일 전(예: 20일 집회 → 12일)까지 도달해야 안전하다.
 */
export function noticeDeadline(m: Meeting): Date | null {
  const d = parseDate(m.date);
  if (!d) return null;
  const days = Math.max(1, Number(m.noticeDays) || 7);
  return addDays(d, -(days + 1));
}

export function scheduleChecks(m: Meeting): Check[] {
  const out: Check[] = [];
  const d = parseDate(m.date);
  if (!d) return [{ level: "info", text: "집회 일자를 입력하면 통지 기한을 계산합니다." }];
  const days = Math.max(1, Number(m.noticeDays) || 7);
  const dl = noticeDeadline(m)!;
  const sendBy = addDays(dl, -3);
  out.push({
    level: "info",
    text: `통지서는 늦어도 ${fmtDate(dl)}까지 구분소유자에게 도달해야 합니다(집회일 ${days}일 전, 초일 불산입). 내용증명은 도달까지 2~3일 걸리므로 ${fmtDate(sendBy)}까지 발송하세요.`,
  });
  const nd = parseDate(m.noticeDate);
  if (nd) {
    const gap = diffDays(d, nd);
    if (nd > dl) out.push({ level: "bad", text: `통지 예정일 ${fmtDate(nd)}은 기한(${fmtDate(dl)})을 넘깁니다. 결의 취소 사유가 됩니다. 집회일을 미루거나 통지를 앞당기세요.` });
    else if (nd > addDays(dl, -2)) out.push({ level: "warn", text: `통지 예정일이 기한에 아슬아슬합니다(집회 ${gap}일 전). 우편 지연에 대비해 하루 이틀 앞당기기를 권합니다.` });
    else out.push({ level: "ok", text: `통지 예정일 ${fmtDate(nd)}: 집회 ${gap}일 전으로 기한을 지킵니다.` });
  } else {
    out.push({ level: "warn", text: "통지(발송) 예정일을 입력하면 기한 준수 여부를 확인합니다." });
  }
  const sd = parseDate(m.submitDeadline);
  if (sd) {
    if (sd > d) out.push({ level: "bad", text: "서면결의서·위임장 제출기한이 집회일보다 늦습니다." });
    else if (nd && sd <= nd) out.push({ level: "bad", text: "서면결의서·위임장 제출기한이 통지일보다 빠릅니다." });
  }
  if (m.kind === "regular") {
    const fe = parseDate(m.fiscalEnd);
    if (fe) {
      const lim = addMonths(fe, 3);
      if (d > lim) out.push({ level: "bad", text: `정기총회는 회계연도 종료 후 3개월 이내(${fmtDate(lim)}까지) 열어야 합니다.` });
      else out.push({ level: "ok", text: `회계연도 종료 후 3개월 이내(${fmtDate(lim)}까지) 개최 요건을 충족합니다.` });
    }
  }
  if (m.convener === "request" || m.convener === "court") {
    const rd = parseDate(m.requestDate);
    if (rd) {
      const n1 = addDays(rd, 7);
      const n2 = addDays(rd, 14);
      if (m.convener === "request") {
        if (d > n2)
          out.push({ level: "bad", text: `청구에 따른 집회일은 청구일로부터 2주 이내(${fmtDate(n2)}까지)여야 합니다. 넘기면 청구인이 법원 허가를 받아 직접 소집할 수 있습니다.` });
        else out.push({ level: "ok", text: `집회일이 청구일로부터 2주 이내(${fmtDate(n2)}까지)입니다.` });
        if (nd && nd > n1) out.push({ level: "bad", text: `관리인은 청구일로부터 1주 이내(${fmtDate(n1)}까지) 소집통지를 해야 합니다.` });
      } else {
        out.push({ level: "info", text: `관리인이 ${fmtDate(n1)}까지 소집통지를 하지 않았다면 청구인은 법원 허가를 받아 소집할 수 있습니다(법 제33조 제3항).` });
      }
    } else {
      out.push({ level: "warn", text: "소집 청구일을 입력하면 관리인의 응답 기한(1주)과 집회일 상한(2주)을 계산합니다." });
    }
  }
  return out;
}

/** 결의 취소의 소 제기 기한(결의일로부터 6개월) */
export function cancelSuitDeadline(m: Meeting): Date | null {
  const d = parseDate(m.date);
  return d ? addMonths(d, 6) : null;
}

/* ---------- 정족수 ---------- */

export const num = (s: string) => {
  const n = Number(String(s ?? "").replace(/[,\s㎡]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const personKey = (o: Owner) => o.name.replace(/\s/g, "") || `#${o.unit}`;

export type Totals = { heads: number; area: number; fromList: boolean };

/** 전체 구분소유자 수(동일인이 여러 호실을 가져도 1명)와 전체 전유면적 */
export function totals(m: Meeting): Totals {
  const named = m.owners.filter((o) => o.unit || o.name);
  if (named.length) {
    const heads = new Set(named.map(personKey)).size;
    const area = named.reduce((s, o) => s + num(o.area), 0);
    return { heads: num(m.totalOwners) || heads, area: num(m.totalArea) || area, fromList: true };
  }
  return { heads: num(m.totalOwners), area: num(m.totalArea), fromList: false };
}

export function needed(total: number, type: ResolutionType) {
  const r = RESOLUTION[type];
  if (r.strict) return Math.floor(total * r.ratio) + 1;
  return Math.ceil(total * r.ratio - 1e-9);
}
export function neededArea(total: number, type: ResolutionType) {
  const r = RESOLUTION[type];
  return total * r.ratio; // strict: 초과, 그 외: 이상
}
export function passes(heads: number, area: number, t: Totals, type: ResolutionType) {
  const r = RESOLUTION[type];
  const hOk = heads >= needed(t.heads, type);
  const aOk = r.strict ? area > t.area * r.ratio + 1e-9 : area >= t.area * r.ratio - 1e-9;
  return { hOk, aOk, ok: t.heads > 0 && t.area > 0 && hOk && aOk };
}

export type Tally = {
  yes: { heads: number; area: number };
  no: { heads: number; area: number };
  abstain: { heads: number; area: number };
  byMode: Record<"present" | "proxy" | "written", { yes: number; no: number; abstain: number }>;
};

/** 명부의 출석·투표로 안건별 찬반을 센다. 동일인의 여러 호실은 면적은 합산, 사람 수는 1명. */
export function tally(m: Meeting, agendaId: string): Tally {
  const sets = { yes: new Set<string>(), no: new Set<string>(), abstain: new Set<string>() };
  const area = { yes: 0, no: 0, abstain: 0 };
  const byMode = {
    present: { yes: 0, no: 0, abstain: 0 },
    proxy: { yes: 0, no: 0, abstain: 0 },
    written: { yes: 0, no: 0, abstain: 0 },
  };
  for (const o of m.owners) {
    if (!o.attend) continue;
    const v = o.votes[agendaId];
    if (!v) continue;
    sets[v].add(personKey(o));
    area[v] += num(o.area);
    byMode[o.attend][v] += 1;
  }
  return {
    yes: { heads: sets.yes.size, area: area.yes },
    no: { heads: sets.no.size, area: area.no },
    abstain: { heads: sets.abstain.size, area: area.abstain },
    byMode,
  };
}

export function attendance(m: Meeting) {
  const by = { present: new Set<string>(), proxy: new Set<string>(), written: new Set<string>() };
  const area = { present: 0, proxy: 0, written: 0 };
  const all = new Set<string>();
  let allArea = 0;
  for (const o of m.owners) {
    if (!o.attend) continue;
    by[o.attend].add(personKey(o));
    area[o.attend] += num(o.area);
    all.add(personKey(o));
    allArea += num(o.area);
  }
  return {
    present: { heads: by.present.size, area: area.present },
    proxy: { heads: by.proxy.size, area: area.proxy },
    written: { heads: by.written.size, area: area.written },
    all: { heads: all.size, area: allArea },
  };
}

export const fmtNum = (n: number, d = 2) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(2)}%` : "-");

/** 명부 붙여넣기: 호실, 성명, 전유면적, 연락처, 주소, 공유자 (탭·쉼표 구분) */
export function parseOwners(text: string): Owner[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(l.includes("\t") ? "\t" : ",").map((s) => s.trim()))
    .filter((c) => !/호실|성명/.test(c.join("")))
    .map((c) => ({ ...emptyOwner(), unit: c[0] ?? "", name: c[1] ?? "", area: c[2] ?? "", phone: c[3] ?? "", address: c[4] ?? "", coOwners: c[5] ?? "" }));
}

/** 안건 번호 표기 */
export const agendaNo = (i: number) => `제${i + 1}호 의안`;

/** 소집권자 표기 */
export function convenerText(m: Meeting) {
  const mgr = m.managerName ? `관리인 ${m.managerName}` : "관리인";
  const rep = m.convenerRep ? `${m.convenerRep}` : "OOO";
  const cnt = num(m.convenerCount);
  const others = cnt > 1 ? ` 외 ${cnt - 1}인` : "";
  switch (m.convener) {
    case "manager":
    case "request":
      return `${m.associationName} ${mgr}`;
    case "noManager":
      return `소집 구분소유자 대표 ${rep}${others}`;
    case "court":
      return `소집 청구 구분소유자 대표 ${rep}${others}${m.courtPermit ? ` (${m.courtPermit} 소집허가)` : ""}`;
  }
}

export const meetingTitle = (m: Meeting) => `${m.year ? `${m.year}년도 ` : ""}${KIND_FORMAL[m.kind]}`;
