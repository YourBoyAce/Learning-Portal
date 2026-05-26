"use client";

import React from "react";
import { useLoading } from "../../context/LoadingContext";

export default function LoadingWrapper({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLoading();
  
  return (
    <div className={isLoading ? "blur-md pointer-events-none select-none transition-all duration-300" : "transition-all duration-300"}>
      {children}
    </div>
  );
}