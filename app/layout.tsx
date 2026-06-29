import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candidate ERP",
  description: "Candidate processing management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body className="font-sans">
        <div className="max-w-[1550px] mx-auto px-6 py-4">{children}</div>
      </body>
    </html>
  );
}
