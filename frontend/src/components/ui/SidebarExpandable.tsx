import { NavLink, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

export type SubNavLink = {
  to: string;
  label: string;
  end?: boolean;
};

type Props = {
  to: string;
  label: string;
  icon: ReactNode;
  /** Paths that keep this group expanded / active */
  matchPrefixes: string[];
  items: SubNavLink[];
  defaultOpen?: boolean;
};

export function SidebarExpandable({
  to,
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
  
  // Keep it open if active, otherwise use internal hover/click state
  const [userOpen, setUserOpen] = useState(defaultOpen);

  const open = active || userOpen;

  return (
    <div 
      className="sidebar-group"
      onMouseEnter={() => setUserOpen(true)}
      onMouseLeave={() => {
        if (!active) setUserOpen(false);
      }}
    >
      <NavLink
        to={to}
        className={`sidebar-link ${active ? "is-active" : ""}`}
        onClick={() => setUserOpen((v) => !v)}
      >
        {icon}
        <span className="truncate">{label}</span>
      </NavLink>

      <div className={`sidebar-group-children-wrapper ${open ? "is-open" : ""}`}>
        <div className="sidebar-group-children-inner">
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
        </div>
      </div>
    </div>
  );
}
