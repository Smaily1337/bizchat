import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "rounded-control bg-white text-[var(--on-accent)] shadow-canary hover:brightness-105 hover:-translate-y-px active:translate-y-0 active:brightness-95",
  ghost:
    "rounded-control border border-glass-border bg-glass-fill/60 text-white backdrop-blur-glass hover:border-white/40 hover:bg-glass-fillStrong active:bg-white/10",
  subtle:
    "rounded-control border border-glass-border/80 bg-transparent font-mono text-xs uppercase tracking-[0.08em] text-frost hover:bg-glass-fill hover:underline underline-offset-4",
};

export function GlassButton({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: GlassButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wide transition duration-200 ease-out will-change-transform disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
