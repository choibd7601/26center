"use client";

import BillReader from "@/components/BillReader";
import { calcElectric, fmt } from "@/lib/bills";

export default function ElectricPage() {
  return (
    <>
      <h1>한전 전기요금 단가</h1>
      <p className="muted">총금액 = 당월요금계 − 가산금 − 연체료 · 단가 = 총금액 ÷ 당월 사용량(kWh)</p>
      <BillReader
        kind="electric"
        renderResult={(v) => {
          const r = calcElectric(v);
          if (!r) return <p className="muted">당월요금계를 입력하면 계산됩니다.</p>;
          return (
            <div className="stats">
              <div className="stat">
                <div className="label">총금액</div>
                <div className="value">{fmt(r.total)} 원</div>
                <div className="muted small">
                  {fmt(v.monthTotal)} − {fmt(v.surcharge ?? 0)} − {fmt(v.lateFee ?? 0)}
                </div>
              </div>
              <div className="stat">
                <div className="label">전기 단가</div>
                <div className="value">{r.unitPrice == null ? "-" : `${fmt(r.unitPrice, 2)} 원/kWh`}</div>
                <div className="muted small">
                  {fmt(r.total)} ÷ {fmt(v.usage)} kWh
                  {r.unitPrice != null && ` · 반올림 ${fmt(Math.round(r.unitPrice))}원`}
                </div>
              </div>
            </div>
          );
        }}
        historyRow={(v) => {
          const r = calcElectric(v);
          return {
            당월요금계: fmt(v.monthTotal),
            가산금: fmt(v.surcharge),
            연체료: fmt(v.lateFee),
            총금액: fmt(r?.total),
            "사용량(kWh)": fmt(v.usage),
            단가: fmt(r?.unitPrice, 2),
          };
        }}
      />
    </>
  );
}
