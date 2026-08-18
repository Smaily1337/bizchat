import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "rounded-control bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 active:opacity-80",
  ghost:
    "rounded-control border border-glass-border bg-transparent text-[var(--text-bright)] hover:bg-glass-fillStrong",
  subtle:
    "rounded-control border border-glass-border bg-transparent font-mono text-xs uppercase tracking-[0.06em] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
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
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wide transition duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
