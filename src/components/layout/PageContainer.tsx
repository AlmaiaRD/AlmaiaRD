"use client";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn("flex-1 max-w-7xl mx-auto w-full px-6 py-6", className)}>
      {children}
    </main>
  );
}
