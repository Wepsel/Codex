import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nebula Ops | Kubernetes Control",
  description: "Hyper-modern control center for Kubernetes clusters"
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-white`}>
        <Providers>
          <AppShell>
            <Suspense fallback={<div className="p-10 text-white/40">Loading...</div>}>
              {children}
            </Suspense>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}

