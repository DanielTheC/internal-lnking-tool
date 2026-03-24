import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Linking Opportunity Finder",
  description: "Find internal linking opportunities for your website."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</div>
      </body>
    </html>
  );
}

