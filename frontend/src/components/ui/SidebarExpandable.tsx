import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

export type SubNavLink = {
  to: string;
  label: string;
  end?: boolean;
};

type Props = {
  label: string;
  icon: ReactNode;
  /** Paths that keep this group expanded / active */
  matchPrefixes: string[];
  items: SubNavLink[];
  defaultOpen?: boolean;
};

export function SidebarExpandable({
  label,
  icon,
  matchPrefixes,
  items,
  defaultOpen = false,
}: Props) {
  const location = useLocation();
  const active = matchPrefixes.some(
    (p) =>
      location.pathname === p || location.pathname.startsWith(`${p}/`),
  );
  const [open, setOpen] = useState(defaultOpen || active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="sidebar-group">
      <button
        type="button"
        className={`sidebar-group-toggle ${active ? "is-active" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="sidebar-group-children">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-sublink ${isActive ? "is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
