import "./globals.css";
import React from "react";
import { Bricolage_Grotesque } from "next/font/google";
import { cn } from "@/lib/utils";
import { LoadingProvider } from "./context/LoadingContext";
import { ThemeProvider } from "./context/ThemeContext";
import LoadingManager from "./components/ui/LoadingManager";
import LoadingWrapper from "./components/ui/LoadingWrapper";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("font-sans", bricolage.variable)}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <LoadingProvider>
            <LoadingManager />
            <LoadingWrapper>
              {children}
            </LoadingWrapper>
          </LoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
