import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--on-ink)] shadow-[0_0_24px_rgba(45,212,191,0.22)] hover:brightness-110 active:brightness-95",
  ghost:
    "border border-[var(--glass-border)] bg-transparent text-[var(--text)] hover:bg-[var(--glass-fill)]",
  subtle:
    "border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text)] backdrop-blur-glass hover:bg-[var(--glass-fill-strong)]",
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
