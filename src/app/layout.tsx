import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/cairo";
import "./globals.css";

export const metadata: Metadata = {
  title: "مدار | منصة إدارة البث",
  description: "لوحة حديثة ومفتوحة لإدارة قنوات البث والمشتركين والخوادم، مع وكيل Python 3 وFFmpeg.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
