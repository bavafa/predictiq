import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { DataProvider } from "@/components/data-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "PredictIQ",
  description: "Portfolio demo: from machine failure predictions to maintenance decisions. Historical sample data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
