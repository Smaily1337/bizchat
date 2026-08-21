import { Icon } from "./Icon";

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg"
      ? "h-12 w-12 min-h-[48px] min-w-[48px] max-h-[48px] max-w-[48px] rounded-2xl"
      : size === "sm"
        ? "h-7 w-7 min-h-[28px] min-w-[28px] max-h-[28px] max-w-[28px] rounded-lg"
        : "h-9 w-9 min-h-[36px] min-w-[36px] max-h-[36px] max-w-[36px] rounded-xl";
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className={`${box} object-cover shrink-0 bg-[var(--accent-soft)]`}
      />
    );
  }

  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)]`}
    >
      {name ? (
        <span className="text-xs font-semibold">{letter}</span>
      ) : (
        <Icon name="person" className="!text-base" />
      )}
    </span>
  );
}
