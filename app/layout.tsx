import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "26센터 관리",
  description: "관리비 청구 자동화: 전기·상하수도 단가 계산, 경비내역서, 총회 준비",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <nav className="nav no-print">
          <Link href="/" className="brand">26센터</Link>
          <Link href="/electric">전기요금</Link>
          <Link href="/water">상하수도</Link>
          <Link href="/expense">경비내역서</Link>
          <Link href="/meeting">총회 준비</Link>
        </nav>
        <main>
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}
