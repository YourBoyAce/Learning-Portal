import "./globals.css";
import React from "react";
import { Roboto } from "next/font/google";
import { cn } from "@/lib/utils";
import { LoadingProvider } from "./context/LoadingContext";
import { ThemeProvider } from "./context/ThemeContext";
import LoadingManager from "./components/ui/LoadingManager";
import LoadingWrapper from "./components/ui/LoadingWrapper";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-roboto",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("font-sans", roboto.variable)}
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
