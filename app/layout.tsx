import "./globals.css";
import React from "react";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { LoadingProvider } from "./context/LoadingContext";
import LoadingManager from "./components/ui/LoadingManager";
import LoadingWrapper from "./components/ui/LoadingWrapper";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={cn("font-sans", geist.variable)}>
      <body>
        <LoadingProvider>
          <LoadingManager />
          <LoadingWrapper>
            {children}
          </LoadingWrapper>
        </LoadingProvider>
      </body>
    </html>
  );
}