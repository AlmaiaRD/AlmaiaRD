"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialized = useAuth((s) => s.initialized);
  const initialize = useAuth((s) => s.initialize);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  return <>{children}</>;
}
