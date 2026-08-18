import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { dashboardApi } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";

type HubTile = {
  to: string;
  title: string;
  blurb: string;
  tourId?: string;
  icon: ReactNode;
};

const icon = "h-7 w-7";

const WORK: HubTile[] = [
  {
    to: "/calendar",
    title: "Kalendarz",
    blurb: "Harmonogram dnia i tygodnia",
    tourId: "nav-calendar",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    to: "/appointments",
    title: "Wizyty",
    blurb: "Lista, statusy, nowa rezerwacja",
    tourId: "nav-appointments",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 11h6M9 15h3" />
        <path d="M8 3h8v3H8z" />
        <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    to: "/inbox",
    title: "Wiadomości",
    blurb: "Messenger, Telegram, odpowiedzi",
    tourId: "nav-inbox",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 7 9-7" />
      </svg>
    ),
  },
];

const PEOPLE: HubTile[] = [
  {
    to: "/customers",
    title: "Klienci",
    blurb: "Baza, tagi, kontakt",
    tourId: "nav-customers",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 19a4.5 4.5 0 0 1 5 0" />
      </svg>
    ),
  },
  {
    to: "/staff",
    title: "Zespół",
    blurb: "Pracownicy i przypisania",
    tourId: "nav-staff",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const SALON: HubTile[] = [
  {
    to: "/channels",
    title: "Kanały",
    blurb: "Webhooki i podłączenia",
    tourId: "nav-channels",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    to: "/reports",
    title: "Raporty",
    blurb: "Statystyki i eksport",
    tourId: "nav-reports",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 19V5M10 19V9M16 19v-6M22 19H2" />
      </svg>
    ),
  },
  {
    to: "/hours",
    title: "Godziny",
    blurb: "Otwarcie i dni wolne",
    tourId: "nav-hours",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    to: "/notifications",
    title: "Powiadomienia",
    blurb: "SMS, e-mail, przypomnienia",
    tourId: "nav-notifications",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    to: "/settings",
    title: "Ustawienia",
    blurb: "Salon, usługi, wygląd",
    tourId: "nav-settings",
    icon: (
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
];

function TileGrid({ tiles }: { tiles: HubTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t, i) => (
        <Link
          key={t.to}
          to={t.to}
          data-tour={t.tourId}
          className="hub-tile group animate-fade-up"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div
            className="hub-tile-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-[var(--surface-solid)] text-[var(--tile-icon)] transition"
            aria-hidden
          >
            {t.icon}
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-[var(--text-bright)] group-hover:text-[var(--accent)]">
              {t.title}
            </p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{t.blurb}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function HomePage() {
  const { business } = useAuth();
  const [today, setToday] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [customers, setCustomers] = useState<number | null>(null);

  useEffect(() => {
    void dashboardApi
      .summary()
      .then((s) => {
        setToday(s.appointments_today);
        setPending(s.pending_count);
        setCustomers(s.customers_total);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-8">
      <header className="page-hero animate-fade-up">
        <p className="font-display text-4xl font-extrabold tracking-tight text-[var(--text-bright)] sm:text-5xl">
          BizChat
        </p>
        <h1 className="mt-2 font-display text-xl font-semibold text-[var(--text-bright)] sm:text-2xl">
          {business?.name || "Twój salon"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
          Dziś w skrócie poniżej — potem skróty do pracy dnia, ludzi i ustawień
          salonu.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="stat-chip">
            <p className="label-caps">Wizyty dziś</p>
            <p className="font-display text-3xl font-bold text-[var(--text-bright)]">
              {today ?? "—"}
            </p>
          </div>
          <div className="stat-chip">
            <p className="label-caps">Oczekujące</p>
            <p className="font-display text-3xl font-bold text-[var(--text-bright)]">
              {pending ?? "—"}
            </p>
          </div>
          <div className="stat-chip">
            <p className="label-caps">Klienci</p>
            <p className="font-display text-3xl font-bold text-[var(--text-bright)]">
              {customers ?? "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/calendar">
            <GlassButton>Otwórz kalendarz</GlassButton>
          </Link>
          <Link to="/appointments">
            <GlassButton variant="ghost">Lista wizyt</GlassButton>
          </Link>
          <Link to="/inbox">
            <GlassButton variant="ghost">Wiadomości</GlassButton>
          </Link>
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-bright)]">
            Praca dnia
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Kalendarz, wizyty i rozmowy z klientami
          </p>
        </div>
        <TileGrid tiles={WORK} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-bright)]">
            Ludzie
          </h2>
          <p className="text-sm text-[var(--muted)]">Klienci i zespół salonu</p>
        </div>
        <TileGrid tiles={PEOPLE} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-bright)]">
            Salon
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Kanały, raporty, godziny i konfiguracja — też w menu <strong>Salon</strong>
          </p>
        </div>
        <TileGrid tiles={SALON} />
      </section>

      <GlassCard className="animate-fade-up">
        <p className="font-display text-base font-semibold text-[var(--text-bright)]">
          Nawigacja
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
          <li className="rounded-control border border-glass-border bg-[var(--surface-solid)] p-3">
            <strong className="text-[var(--text-bright)]">Góra:</strong> Start,
            Kalendarz, Wizyty, Wiadomości, Klienci
          </li>
          <li className="rounded-control border border-glass-border bg-[var(--surface-solid)] p-3">
            <strong className="text-[var(--text-bright)]">Salon ▾:</strong>{" "}
            pracownicy, kanały, godziny, ustawienia…
          </li>
          <li className="rounded-control border border-glass-border bg-[var(--surface-solid)] p-3">
            <strong className="text-[var(--text-bright)]">Konto:</strong> motyw i
            wylogowanie
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
