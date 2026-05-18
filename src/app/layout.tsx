import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeScope",
  description: "개인용 부동산 관심 단지 리서치 보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
