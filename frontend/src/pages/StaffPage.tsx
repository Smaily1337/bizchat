import { type FormEvent, useEffect, useState } from "react";
import { staffApi } from "@/api";
import type { StaffMember } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

export function StaffPage() {
  const [items, setItems] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    setItems(await staffApi.list());
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await staffApi.create({ name: name.trim() });
      setName("");
      setMsg("Dodano specjalistę");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Zespół</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Specjaliści do rezerwacji (grafik wieloosobowy)
        </p>
      </header>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <GlassCard>
        <form className="flex flex-wrap gap-2" onSubmit={onCreate}>
          <GlassInput
            className="min-w-[200px] flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Imię stylisty"
            required
          />
          <GlassButton type="submit">Dodaj</GlassButton>
        </form>
      </GlassCard>

      <div className="space-y-2">
        {items.map((s) => (
          <GlassCard key={s.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display font-semibold">{s.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {s.is_active ? "aktywny" : "nieaktywny"}
              </p>
            </div>
            {s.is_active && (
              <GlassButton
                type="button"
                variant="ghost"
                className="!px-3 !py-1.5 text-xs"
                onClick={() =>
                  void staffApi.remove(s.id).then(reload).catch((e: Error) => setError(e.message))
                }
              >
                Dezaktywuj
              </GlassButton>
            )}
          </GlassCard>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Brak członków zespołu.</p>
        )}
      </div>
    </div>
  );
}
