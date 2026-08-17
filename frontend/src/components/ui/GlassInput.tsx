import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-none border-0 border-b border-white/70 bg-surface px-3.5 py-2.5 text-sm text-frost outline-none transition placeholder:text-[var(--muted)] focus:border-b-2 focus:border-white focus:text-white";

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
  return (
    <textarea
      className={`${fieldClass} min-h-[88px] resize-y rounded-soft border border-glass-border border-b-white/70 ${className}`}
      {...rest}
    />
  );
}
