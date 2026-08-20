import { type ChangeEvent, type FormEvent, useEffect, useState, useRef } from "react";
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

function compressImage(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function StaffPage() {
  const { push } = useToast();
  const [items, setItems] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(STAFF_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editColor, setEditColor] = useState(STAFF_COLORS[0]);
  const [loading, setLoading] = useState(true);

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setItems(await staffApi.list());
  }

  useEffect(() => {
    void reload()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAvatarSelect(
    e: ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 360);
      setter(compressed);
    } catch {
      push({
        title: "Błąd zdjęcia",
        message: "Nie udało się wczytać wybranego pliku graficznego",
        tone: "canary",
      });
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await staffApi.create({
        name: name.trim(),
        avatar_url: avatarUrl,
        color: selectedColor,
      });
      setName("");
      setAvatarUrl(null);
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
        avatar_url: editAvatarUrl,
        color: editColor,
      });
      push({
        title: "Zaktualizowano pracownika",
        message: "Dane pracownika i zdjęcie zostały zapisane",
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
              Zarządzaj pracownikami, zdjęciami profilowymi i dostępnością w kalendarzu
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
        <section className="glass-panel rounded-2xl p-6 shadow-2xl border border-[var(--primary)]/30 animate-fade-up">
          <h2 className="font-display text-base font-bold text-[var(--text-bright)] mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
              person_add
            </span>
            Dodaj nowego pracownika do zespołu
          </h2>
          <p className="text-xs text-[var(--muted)] mb-5">
            Wpisz dane pracownika i dodaj opcjonalne zdjęcie profilowe do wyświetlania w terminarzu.
          </p>

          <form className="space-y-4" onSubmit={onCreate}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar Upload Preview */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <input
                  type="file"
                  ref={addFileInputRef}
                  onChange={(e) => void handleAvatarSelect(e, setAvatarUrl)}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={() => addFileInputRef.current?.click()}
                  style={{ backgroundColor: avatarUrl ? "transparent" : selectedColor }}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--primary)] transition-all overflow-hidden relative group shadow-md"
                  title="Kliknij, aby wybrać zdjęcie profilowe"
                >
                  {avatarUrl ? (
                    <>
                      <img
                        src={avatarUrl}
                        alt="Podgląd"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-white/80 group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                      <span className="text-[10px] font-semibold mt-0.5">Zdjęcie</span>
                    </div>
                  )}
                </div>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-[11px] text-red-400 hover:underline cursor-pointer"
                  >
                    Usuń zdjęcie
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 w-full space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--muted)]">
                    Imię i nazwisko pracownika
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
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <GlassButton type="submit" variant="primary">
                <span className="material-symbols-outlined text-[18px]">check</span>
                Zapisz pracownika
              </GlassButton>
            </div>
          </form>
        </section>
      )}

      {/* Edit Staff Modal / Section */}
      {editingStaff && (
        <section className="glass-panel rounded-2xl p-6 shadow-2xl border border-[var(--accent)]/40 animate-fade-up">
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
              className="text-[var(--muted)] hover:text-white p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSaveEdit}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Edit Avatar Upload Preview */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={(e) => void handleAvatarSelect(e, setEditAvatarUrl)}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  style={{ backgroundColor: editAvatarUrl ? "transparent" : editColor }}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--primary)] transition-all overflow-hidden relative group shadow-md"
                  title="Kliknij, aby zmienić zdjęcie profilowe"
                >
                  {editAvatarUrl ? (
                    <>
                      <img
                        src={editAvatarUrl}
                        alt="Podgląd"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-white/80 group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                      <span className="text-[10px] font-semibold mt-0.5">Dodaj foto</span>
                    </div>
                  )}
                </div>
                {editAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setEditAvatarUrl(null)}
                    className="text-[11px] text-red-400 hover:underline cursor-pointer"
                  >
                    Usuń zdjęcie
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 w-full space-y-3">
                <div className="space-y-1">
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
                    Kolor w kalendarzu
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
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <GlassButton type="button" variant="ghost" onClick={() => setEditingStaff(null)}>
                Anuluj
              </GlassButton>
              <GlassButton type="submit" variant="primary">
                Zapisz zmiany
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
            Twoje konto jest czyste. Dodaj pracowników lub specjalistów ze zdjęciami profilowymi, aby móc przypisywać ich do wizyt i zarządzać ich dostępnością w kalendarzu.
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
                  {s.avatar_url ? (
                    <img
                      src={s.avatar_url}
                      alt={s.name}
                      className="w-12 h-12 rounded-xl object-cover border border-white/20 shadow-md shrink-0"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: s.color || "#3e63dd" }}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white shadow-md shrink-0"
                    >
                      {initials(s.name)}
                    </div>
                  )}

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
                      setEditAvatarUrl(s.avatar_url || null);
                      setEditColor(s.color || STAFF_COLORS[0]);
                      setShowAdd(false);
                    }}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Edytuj pracownika i zdjęcie"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStatus(s)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
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
