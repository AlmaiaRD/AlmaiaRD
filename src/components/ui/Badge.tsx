"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  success: "bg-[#86C7A3]/15 text-[#86C7A3]",
  warning: "bg-[#E8C87A]/15 text-[#E8C87A]",
  danger: "bg-[#D4A0A0]/15 text-[#D4A0A0]",
  neutral: "bg-[#E8E0D8]/50 text-[#9C8A82]",
  info: "bg-[#B8837E]/10 text-[#B8837E]",
};

export default function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantMap[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
