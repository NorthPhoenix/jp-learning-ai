import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google"

import { TRPCReactProvider } from "~/trpc/react";

const _geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const _notoSansJP = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-sans-jp" })

export const metadata: Metadata = {
  title: "日本語 AI - Voice-First Japanese Learning",
  description: "Practice speaking Japanese with an AI tutor",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${_geist.variable} ${_geistMono.variable} ${_notoSansJP.variable} antialiased`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}