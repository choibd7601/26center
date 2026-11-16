// 고지서 종류별 판독 항목 정의와 계산식 (서버/클라이언트 공용)

export type BillKind = "electric" | "water";

export type FieldDef = {
  key: string;
  label: string;
  unit: string;
  hint: string; // 판독 모델에게 주는 설명
};

export const BILL_FIELDS: Record<BillKind, FieldDef[]> = {
  electric: [
    {
      key: "monthTotal",
      label: "당월요금계",
      unit: "원",
      hint: "'당월요금계' 라고 적힌 칸의 금액 (청구금액/납기내금액이 아님)",
    },
    { key: "surcharge", label: "가산금", unit: "원", hint: "'가산금' 칸의 금액" },
    { key: "lateFee", label: "연체료", unit: "원", hint: "'연체료' 칸의 금액" },
    {
      key: "usage",
      label: "당월 사용량",
      unit: "kWh",
      hint: "'당월' 사용량(kWh). 전월/전년동월 사용량이 아닌 당월 값",
    },
  ],
  water: [
    { key: "waterFee", label: "상수도요금", unit: "원", hint: "'상수도요금' 금액" },
    { key: "sewerFee", label: "하수도요금", unit: "원", hint: "'하수도요금' 금액" },
    { key: "waterUseCharge", label: "물이용부담금", unit: "원", hint: "'물이용부담금' 금액" },
    {
      key: "usage",
      label: "사용량",
      unit: "㎥(톤)",
      hint: "이번 달 사용량(㎥ 또는 톤). 전월/전년 사용량이 아닌 당월 값",
    },
  ],
};

export const BILL_TITLES: Record<BillKind, string> = {
  electric: "한전 전기요금 고지서",
  water: "상하수도 요금 고지서",
};

export type ReadField = {
  key: string;
  value: number | null;
  text: string; // 고지서에 적힌 그대로의 글자
  box: [number, number, number, number] | null; // 0~1 비율 [x0, y0, x1, y1]
  note?: string;
};

export type ReadResult = {
  billingMonth: string | null;
  fields: ReadField[];
  warnings: string[];
};

export function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? "-"
    : n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// 전기: 총금액 = 당월요금계 - 가산금 - 연체료, 단가 = 총금액 / 당월사용량
export function calcElectric(v: Record<string, number | null>) {
  const { monthTotal, surcharge, lateFee, usage } = v;
  if (monthTotal == null) return null;
  const total = monthTotal - (surcharge ?? 0) - (lateFee ?? 0);
  const unitPrice = usage ? total / usage : null;
  return { total, unitPrice };
}

// 상하수도: 각 요금 / 사용량
export function calcWater(v: Record<string, number | null>) {
  const { waterFee, sewerFee, waterUseCharge, usage } = v;
  const per = (x: number | null) => (x != null && usage ? x / usage : null);
  return {
    water: per(waterFee),
    sewer: per(sewerFee),
    waterUse: per(waterUseCharge),
    total: (waterFee ?? 0) + (sewerFee ?? 0) + (waterUseCharge ?? 0),
  };
}
