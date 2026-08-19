import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-[rgba(19,19,21,0.4)] px-4 py-3 font-body-md text-body-md text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-primary-container focus:bg-[rgba(19,19,21,0.6)] focus:ring-2 focus:ring-primary-container/20";

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
  return <textarea className={`${fieldClass} min-h-[88px] resize-y ${className}`} {...rest} />;
}
