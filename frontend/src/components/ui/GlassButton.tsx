import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle" | "gradient" | "danger";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "rounded-control btn-primary text-white shadow-lg hover:scale-[1.02] active:scale-[0.98]",
  gradient:
    "rounded-control btn-gradient text-white shadow-lg hover:scale-[1.02] active:scale-[0.98]",
  ghost:
    "rounded-control border border-glass-border bg-[var(--glass-fill-strong)] text-[var(--text-bright)] backdrop-blur-glass hover:border-[var(--accent)] hover:bg-[var(--glass-fill)]",
  subtle:
    "rounded-control border border-glass-border bg-[var(--glass-fill)] text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)] backdrop-blur-glass hover:border-[var(--accent)] hover:text-[var(--accent)]",
  danger:
    "rounded-control border border-red-500/30 bg-red-500/10 text-red-400 backdrop-blur-glass hover:bg-red-500/20 hover:border-red-500/50",
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
