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
      hint: "왼쪽 '청구내역' 표의 '당월요금계' 금액 (예: 12,177,040). '전기요금계', '청구금액', '미납전기요금'과 혼동 금지",
    },
    { key: "surcharge", label: "가산금", unit: "원", hint: "'청구내역' 표의 '가산금' 금액" },
    { key: "lateFee", label: "연체료", unit: "원", hint: "'청구내역' 표의 '연체료' 금액" },
    {
      key: "usage",
      label: "당월 사용량",
      unit: "kWh",
      hint: "오른쪽 '사용량비교'의 '당월' kWh (= '사용량사항'의 사용량). 전월·전년동월 값이 아님",
    },
  ],
  water: [
    { key: "waterFee", label: "상수도요금", unit: "원", hint: "'상수도' 열의 '고지금액' (구경별요금+사용요금 합계). '사용요금' 행이나 납기후금액이 아님. 하단 수납의뢰서의 '상수도요금'(납기내)과 같은 값" },
    { key: "sewerFee", label: "하수도요금", unit: "원", hint: "'하수도' 열의 '고지금액' (납기내). 납기후금액이 아님" },
    { key: "waterUseCharge", label: "물이용부담금", unit: "원", hint: "'물이용부담금' 열의 '고지금액' (납기내). 납기후금액이 아님" },
    {
      key: "usage",
      label: "사용량",
      unit: "㎥(톤)",
      hint: "오른쪽 검침 표의 '사용량' (㎥). 지침값(전월/당월 지침)이 아님",
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
