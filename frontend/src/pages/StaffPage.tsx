import { type FormEvent, useEffect, useState } from "react";
import { staffApi } from "@/api";
import type { StaffMember } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton } from "@/components/ui";

const STAFF_COLORS = [
  "#3e63dd",
  "#00a389",
  "#954181",
  "#f76808",
  "#62539f",
  "#e5484d",
  "#30a46c",
  "#8e4ec6",
];

function initials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function StaffPage() {
  const { push } = useToast();
  const [items, setItems] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(STAFF_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(STAFF_COLORS[0]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setItems(await staffApi.list());
  }

  useEffect(() => {
    void reload()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await staffApi.create({
        name: name.trim(),
        color: selectedColor,
      });
      setName("");
      setShowAdd(false);
      push({
        title: "Dodano pracownika",
        message: `Pomyślnie dodano pracownika do zespołu`,
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania pracownika");
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingStaff || !editName.trim()) return;
    try {
      await staffApi.update(editingStaff.id, {
        name: editName.trim(),
        color: editColor,
      });
      push({
        title: "Zaktualizowano pracownika",
        message: "Dane pracownika zostały zapisane",
        tone: "canary",
      });
      setEditingStaff(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu danych pracownika");
    }
  }

  async function onToggleStatus(s: StaffMember) {
    const nextStatus = !s.is_active;
    try {
      await staffApi.update(s.id, { is_active: nextStatus });
      push({
        title: nextStatus ? "Aktywowano pracownika" : "Dezaktywowano pracownika",
        message: `Status pracownika ${s.name} został zmieniony`,
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zmiany statusu");
    }
  }

  const activeCount = items.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Page Header & Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">badge</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Twój Zespół
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Zarządzaj pracownikami, przypisuj ich do wizyt i konfiguruj terminarz
            </p>
          </div>
        </div>

        <GlassButton
          variant={showAdd ? "ghost" : "primary"}
          onClick={() => {
            setShowAdd((v) => !v);
            setEditingStaff(null);
          }}
        >
          <span className="material-symbols-outlined text-[18px]">
            {showAdd ? "close" : "add"}
          </span>
          {showAdd ? "Zamknij" : "Dodaj pracownika"}
        </GlassButton>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Add Staff Form */}
      {showAdd && (
        <section className="glass-panel rounded-xl p-6 shadow-2xl border border-[var(--primary)]/30 animate-fade-up">
          <h2 className="font-display text-base font-bold text-[var(--text-bright)] mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
              person_add
            </span>
            Dodaj nowego pracownika do zespołu
          </h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Wpisz imię i nazwisko pracownika, aby był dostępny przy rezerwacjach i w kalendarzu.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 items-end" onSubmit={onCreate}>
            <div className="flex-1 w-full space-y-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Imię i nazwisko
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Jan Kowalski"
                className="w-full bg-[var(--surface-container)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Kolor w kalendarzu
              </label>
              <div className="flex items-center gap-1.5 py-1">
                {STAFF_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      selectedColor === c ? "ring-2 ring-white scale-125" : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            <GlassButton type="submit" variant="primary" className="shrink-0">
              <span className="material-symbols-outlined text-[18px]">check</span>
              Zapisz pracownika
            </GlassButton>
          </form>
        </section>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <section className="glass-panel rounded-xl p-6 shadow-2xl border border-[var(--accent)]/40 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--accent)] text-[20px]">
                edit
              </span>
              Edytuj pracownika: {editingStaff.name}
            </h2>
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="text-[var(--muted)] hover:text-white p-1"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <form className="flex flex-col sm:flex-row gap-3 items-end" onSubmit={onSaveEdit}>
            <div className="flex-1 w-full space-y-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Imię i nazwisko
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[var(--surface-container)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Kolor
              </label>
              <div className="flex items-center gap-1.5 py-1">
                {STAFF_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      editColor === c ? "ring-2 ring-white scale-125" : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GlassButton type="submit" variant="primary">
                Zapisz zmiany
              </GlassButton>
              <GlassButton type="button" variant="ghost" onClick={() => setEditingStaff(null)}>
                Anuluj
              </GlassButton>
            </div>
          </form>
        </section>
      )}

      {/* Real Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-[var(--glass-border)]">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1 font-semibold">Aktywni Pracownicy</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text-bright)]">
              {activeCount}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center border border-green-500/20">
            <span className="material-symbols-outlined text-[22px]">person_check</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-[var(--glass-border)]">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1 font-semibold">Wszyscy w Zespole</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text-bright)]">
              {items.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <span className="material-symbols-outlined text-[22px]">group</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-[var(--glass-border)]">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1 font-semibold">Status Zespołu</p>
            <p className="text-base sm:text-lg font-bold text-[var(--text-bright)]">
              {items.length === 0
                ? "Brak personelu"
                : activeCount === items.length
                ? "Wszyscy aktywni"
                : `${activeCount} z ${items.length} aktywnych`}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <span className="material-symbols-outlined text-[22px]">domain_verification</span>
          </div>
        </div>
      </div>

      {/* Staff Grid or Clean Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-panel rounded-xl p-6 h-40 skeleton-shimmer" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 px-6 glass-panel rounded-2xl text-center flex flex-col items-center justify-center border border-[var(--glass-border)]">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--muted)] mb-4 shadow-inner">
            <span className="material-symbols-outlined text-3xl">badge</span>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-bright)] mb-1">
            Brak pracowników w zespole
          </h3>
          <p className="text-xs text-[var(--muted)] max-w-md mb-6 leading-relaxed">
            Twoje konto jest czyste. Dodaj pracowników lub specjalistów, aby móc przypisywać ich do wizyt, usług oraz zarządzać ich dostępnością w kalendarzu.
          </p>
          <GlassButton
            type="button"
            variant="primary"
            onClick={() => {
              setShowAdd(true);
              setEditingStaff(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Dodaj pierwszego pracownika
          </GlassButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((s) => (
            <div
              key={s.id}
              className="glass-panel rounded-xl p-5 flex flex-col justify-between border border-[var(--glass-border)] hover:border-white/20 transition-all hover:scale-[1.01]"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: s.color || "#3e63dd" }}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white shadow-md shrink-0"
                  >
                    {initials(s.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-bright)]">{s.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        s.is_active ? "text-green-400" : "text-[var(--muted)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.is_active ? "bg-green-400" : "bg-gray-500"
                        }`}
                      />
                      {s.is_active ? "Aktywny w grafiku" : "Nieaktywny"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStaff(s);
                      setEditName(s.name);
                      setEditColor(s.color || STAFF_COLORS[0]);
                      setShowAdd(false);
                    }}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 rounded-lg transition-colors"
                    title="Edytuj pracownika"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStatus(s)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      s.is_active
                        ? "text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10"
                        : "text-[var(--muted)] hover:text-green-400 hover:bg-green-500/10"
                    }`}
                    title={s.is_active ? "Dezaktywuj" : "Aktywuj"}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {s.is_active ? "block" : "check_circle"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Dostępny w rezerwacjach</span>
                <span className="font-semibold text-[var(--text-bright)]">
                  {s.is_active ? "Tak" : "Nie"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
