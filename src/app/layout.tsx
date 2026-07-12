import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Unseen Doc",
    default: "Unseen Doc",
  },
  description: "ระบบออกเอกสารธุรกิจที่ทุกคนเข้าถึงได้",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
