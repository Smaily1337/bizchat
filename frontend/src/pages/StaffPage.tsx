import { type FormEvent, useEffect, useState } from "react";
import { staffApi } from "@/api";
import type { StaffMember } from "@/api/types";
import { useToast } from "@/components/ToastProvider";

function initials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function StaffPage() {
  const { push } = useToast();
  const [items, setItems] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function reload() {
    setItems(await staffApi.list());
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await staffApi.create({ name: name.trim() });
      setName("");
      setShowAdd(false);
      push({
        title: "Dodano pracownika",
        message: `Pomyślnie dodano specjalistę do zespołu`,
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania pracownika");
    }
  }

  async function onDeactivate(s: StaffMember) {
    if (!confirm(`Czy chcesz zmienić status pracownika ${s.name}?`)) return;
    try {
      await staffApi.remove(s.id);
      push({
        title: "Zaktualizowano pracownika",
        message: `Zmieniono status dla: ${s.name}`,
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  const activeCount = items.filter((s) => s.is_active).length;

  return (
    <div className="animate-fade-up">
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Twój Zespół</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Zarządzaj pracownikami, przypisuj usługi i śledź ich wydajność.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs text-white font-medium shadow-lg shadow-primary-container/20 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">
            {showAdd ? "close" : "add"}
          </span>
          {showAdd ? "Zamknij formularz" : "Dodaj pracownika"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Add Staff Form */}
      {showAdd && (
        <div className="glass-panel rounded-xl p-6 mb-8 border border-primary/20 shadow-2xl animate-fade-up">
          <h2 className="text-lg font-bold text-on-surface mb-1">
            Dodaj nowego specjalistę
          </h2>
          <p className="text-xs text-on-surface-variant mb-4">
            Wpisz imię i nazwisko, aby udostępnić specjalistę w terminarzu i rezerwacjach.
          </p>
          <form className="flex flex-col sm:flex-row gap-3" onSubmit={onCreate}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Anna Kowalska"
              className="flex-1 bg-surface-container border border-white/10 rounded-lg px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
              required
            />
            <button
              type="submit"
              className="btn-primary px-6 py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">check</span>
              Zapisz specjalistę
            </button>
          </form>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between border border-white/5">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 font-medium">Aktywni Pracownicy</p>
            <p className="text-3xl font-bold text-on-surface">{activeCount || 12}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary">badge</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl flex items-center justify-between border border-white/5">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 font-medium">Dostępność (Dzisiaj)</p>
            <p className="text-3xl font-bold text-on-surface">
              {activeCount ? `${activeCount}/${items.length}` : "8/12"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center border border-secondary/20">
            <span className="material-symbols-outlined text-secondary">event_available</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl flex items-center justify-between border border-white/5">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 font-medium">Zrealizowane Wizyty</p>
            <p className="text-3xl font-bold text-on-surface">148</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center border border-tertiary/20">
            <span className="material-symbols-outlined text-tertiary">check_circle</span>
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.length === 0 ? (
          <>
            <div className="glass-card rounded-xl p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center text-xl font-bold text-primary">
                      AK
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-surface" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">Anna Kowalska</h3>
                    <p className="text-xs text-primary font-medium">Senior Stylist</p>
                  </div>
                </div>
                <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
              <div className="flex flex-col gap-2 mb-6 text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  anna.k@automovia.pl
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">call</span>
                  +48 123 456 789
                </div>
              </div>
              <div className="mt-auto pt-2">
                <p className="text-[10px] text-on-surface-variant mb-2 uppercase tracking-wider font-semibold">Przypisane Usługi</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">Strzyżenie Damskie</span>
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">Koloryzacja</span>
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">+3 inne</span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-20 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center text-xl font-bold text-secondary">
                      MN
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-surface" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">Marek Nowak</h3>
                    <p className="text-xs text-primary font-medium">Master Barber</p>
                  </div>
                </div>
                <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
              <div className="flex flex-col gap-2 mb-6 text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  marek.n@automovia.pl
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">call</span>
                  +48 987 654 321
                </div>
              </div>
              <div className="mt-auto pt-2">
                <p className="text-[10px] text-on-surface-variant mb-2 uppercase tracking-wider font-semibold">Przypisane Usługi</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">Strzyżenie Męskie</span>
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">Trymowanie Brody</span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-20 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center text-xl font-bold text-on-surface-variant">
                      EW
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-surface-variant border-2 border-surface" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">Ewa Wiśniewska</h3>
                    <p className="text-xs text-primary font-medium">Junior Stylist</p>
                  </div>
                </div>
                <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
              <div className="flex flex-col gap-2 mb-6 text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  ewa.w@automovia.pl
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">call</span>
                  +48 555 444 333
                </div>
              </div>
              <div className="mt-auto pt-2">
                <p className="text-[10px] text-on-surface-variant mb-2 uppercase tracking-wider font-semibold">Przypisane Usługi</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">Strzyżenie Dziecięce</span>
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface">Modelowanie</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          items.map((s, idx) => (
            <div
              key={s.id}
              className="glass-card rounded-xl p-6 flex flex-col relative overflow-hidden group border border-white/5"
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary ${idx === 0 ? 'opacity-50' : 'opacity-20'} group-hover:opacity-100 transition-opacity`} />
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center text-xl font-bold text-primary">
                      {initials(s.name)}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-surface ${
                        s.is_active ? "bg-green-500" : "bg-surface-variant"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">{s.name}</h3>
                    <p className="text-xs text-primary font-medium">
                      {s.is_active ? "Specjalista" : "Nieaktywny"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeactivate(s)}
                  className="text-on-surface-variant hover:text-red-400 transition-colors p-1"
                  title="Zmień status"
                >
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 mb-6 text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  {s.name.toLowerCase().replace(/\s+/g, ".")}@automovia.pl
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">call</span>
                  +48 123 456 789
                </div>
              </div>

              <div className="mt-auto pt-2 border-t border-white/5">
                <p className="text-[10px] text-on-surface-variant mb-2 uppercase tracking-wider font-semibold">
                  Przypisane Usługi
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface font-medium">
                    Wszystkie usługi
                  </span>
                  <span className="px-2 py-1 rounded-md bg-surface-container-high border border-white/5 text-xs text-on-surface font-medium">
                    Konsultacja
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
