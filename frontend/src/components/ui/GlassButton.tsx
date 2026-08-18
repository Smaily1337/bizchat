import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "rounded-control bg-[var(--ink)] text-[#fafafa] shadow-canary hover:opacity-90 active:opacity-80 dark:text-[#0b0b0b]",
  ghost:
    "rounded-control border border-glass-border bg-[var(--glass-fill-strong)] text-[var(--text-bright)] backdrop-blur-glass hover:border-[var(--accent)]",
  subtle:
    "rounded-control border border-glass-border bg-[var(--glass-fill)] text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)] backdrop-blur-glass hover:border-[var(--accent)] hover:text-[var(--accent)]",
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
