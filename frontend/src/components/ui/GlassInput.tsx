import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none backdrop-blur-glass transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-[var(--glass-fill-strong)]";

export function GlassInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${fieldClass} ${className}`} {...rest} />;
}

export function GlassSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`${fieldClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function GlassTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${fieldClass} min-h-[88px] ${className}`} {...rest} />;
}
