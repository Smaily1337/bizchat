import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
} as const;

export function GlassCard({
  children,
  className = "",
  padding = "md",
  ...props
}: GlassCardProps) {
  return (
    <div className={`glass-panel ${className}`} {...props}>
      <div className={`relative z-10 ${paddingClasses[padding]}`}>{children}</div>
    </div>
  );
}
