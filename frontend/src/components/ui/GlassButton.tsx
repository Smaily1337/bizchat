import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "rounded-none bg-white text-[var(--on-accent)] hover:bg-[#e2e2e2] active:bg-[#c6c6c7]",
  ghost:
    "rounded-control border border-white/80 bg-transparent text-white hover:bg-glass-fillStrong active:bg-white/10",
  subtle:
    "rounded-control border border-glass-border bg-glass-fill font-mono text-xs uppercase tracking-[0.08em] text-frost underline-offset-4 hover:underline hover:bg-glass-fillStrong",
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
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wide transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-45 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
