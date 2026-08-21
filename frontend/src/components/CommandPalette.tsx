import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appointmentsApi, customersApi } from "@/api";
import type { Appointment, Customer } from "@/api/types";
import { GlassInput } from "@/components/ui/GlassInput";

type Hit = {
  id: string;
  label: string;
  hint: string;
  to: string;
};

const PAGES: Hit[] = [
  { id: "p-cal", label: "Kalendarz", hint: "Widok tygodnia", to: "/" },
  { id: "p-apt", label: "Wizyty", hint: "Lista i nowa rezerwacja", to: "/appointments" },
  { id: "p-inb", label: "Inbox", hint: "Wiadomości z kanałów", to: "/inbox" },
  { id: "p-cus", label: "Klienci", hint: "Baza kontaktów", to: "/customers" },
  { id: "p-not", label: "Powiadomienia", hint: "SMS i szablony", to: "/notifications" },
  { id: "p-set", label: "Ustawienia", hint: "Salon i usługi", to: "/settings" },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    void appointmentsApi.list().then(setAppointments).catch(() => undefined);
    void customersApi.list().then(setCustomers).catch(() => undefined);
  }, [open]);

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pages = PAGES.filter(
      (p) =>
        !query ||
        p.label.toLowerCase().includes(query) ||
        p.hint.toLowerCase().includes(query),
    );
    const people: Hit[] = customers
      .filter((c) => {
        const blob = `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
        return !query || blob.includes(query);
      })
      .slice(0, 6)
      .map((c) => ({
        id: `c-${c.id}`,
        label: c.name || "Klient",
        hint: [c.phone, c.email].filter(Boolean).join(" · ") || "Kontakt",
        to: `/customers?id=${c.id}`,
      }));
    const visits: Hit[] = appointments
      .filter((a) => {
        const blob = `${a.customer_name || ""} ${a.service_name || ""}`.toLowerCase();
        return !query || blob.includes(query);
      })
      .slice(0, 6)
      .map((a) => ({
        id: `a-${a.id}`,
        label: a.service_name || "Wizyta",
        hint: `${a.customer_name || "Klient"} · ${new Date(a.start_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}`,
        to: `/appointments?edit=${a.id}`,
      }));
    return { pages, people, visits };
  }, [q, appointments, customers]);

  if (!open) return null;

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 px-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassInput
          autoFocus
          placeholder="Szukaj stron, klientów, wizyt…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-none border-0 border-b border-[var(--border)] bg-transparent"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2 text-sm">
          <Section title="Przejdź" items={hits.pages} onPick={go} />
          <Section title="Klienci" items={hits.people} onPick={go} />
          <Section title="Wizyty" items={hits.visits} onPick={go} />
          {hits.pages.length + hits.people.length + hits.visits.length === 0 && (
            <p className="px-2 py-6 text-center text-[var(--muted)]">Nic nie znaleziono</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  onPick,
}: {
  title: string;
  items: Hit[];
  onPick: (to: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        {title}
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.to)}
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
        >
          <span>{item.label}</span>
          <span className="ml-3 truncate text-xs text-[var(--muted)]">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
