import "./globals.css";
import React from "react";
import { Roboto } from "next/font/google";
import { cn } from "@/lib/utils";
import { LoadingProvider } from "./context/LoadingContext";
import LoadingManager from "./components/ui/LoadingManager";
import LoadingWrapper from "./components/ui/LoadingWrapper";
import { COLOR_CSS_VARIABLES } from "./styles/colors";
import { TYPOGRAPHY_CSS_VARIABLES } from "./styles/typography";

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
      style={
        {
          ...COLOR_CSS_VARIABLES,
          ...TYPOGRAPHY_CSS_VARIABLES,
        } as React.CSSProperties
      }
    >
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
