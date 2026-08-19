import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "primary" | "ghost" | "subtle";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
};

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "rounded-control bg-gradient-to-r from-[#8083ff] to-[#494bd6] text-white shadow-md hover:shadow-[0_0_20px_rgba(128,131,255,0.3)] hover:scale-[1.02] active:scale-[0.98]",
  ghost:
    "rounded-control border border-white/10 bg-surface-container/60 text-on-surface backdrop-blur-xl hover:border-primary",
  subtle:
    "rounded-control border border-white/10 bg-surface-container/60 text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant backdrop-blur-xl hover:border-primary hover:text-primary",
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
