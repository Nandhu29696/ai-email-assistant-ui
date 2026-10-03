import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "MailAI · Email Intake", template: "%s · MailAI" },
  description: "Automatic email intake: domain check, acknowledgement, attachment validation, PDF conversion and merge.",
  applicationName: "MailAI",
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
