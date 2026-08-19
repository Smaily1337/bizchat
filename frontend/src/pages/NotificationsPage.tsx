import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { appointmentsApi, customersApi, notificationsApi } from "@/api";
import type {
  Appointment,
  Customer,
  NotificationChannel,
  NotificationKind,
  NotificationLogEntry,
  NotificationSettings,
  NotificationTemplate,
} from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  sms: "SMS",
  email: "E-mail",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  widget: "Widget",
};

const KIND_LABEL: Record<NotificationKind, string> = {
  reminder: "Przypomnienie",
  custom: "Własna",
  waitlist: "Waitlist",
  feedback: "Opinia",
};

const LEAD_PRESETS = [
  { minutes: 1440, label: "24 h" },
  { minutes: 120, label: "2 h" },
  { minutes: 30, label: "30 min" },
];

function leadLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} dn.`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

export function NotificationsPage() {
  const { section } = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const active = section || "send";
  const { push } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [log, setLog] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- send form ---
  const [targetMode, setTargetMode] = useState<"appointment" | "customer">(
    "appointment",
  );
  const [sendForm, setSendForm] = useState({
    appointment_id: searchParams.get("appointment") || "",
    customer_id: searchParams.get("customer") || "",
    template_id: "",
    channel: "" as NotificationChannel | "",
    body: "",
  });
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);

  // --- settings form ---
  const [settingsForm, setSettingsForm] = useState({
    reminders_enabled: true,
    lead_times_min: [1440, 120, 30] as number[],
    max_per_appointment: 3,
    default_channel: "sms" as NotificationChannel,
    custom_lead: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // --- templates ---
  const [editingTemplate, setEditingTemplate] =
    useState<NotificationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    kind: "custom" as NotificationKind,
    body: "",
  });
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  async function reload() {
    const [a, c, t, s, l] = await Promise.all([
      appointmentsApi.list(),
      customersApi.list(),
      notificationsApi.templates(),
      notificationsApi.settings(),
      notificationsApi.log(50),
    ]);
    setAppointments(a.filter((x) => x.status !== "cancelled"));
    setCustomers(c);
    setTemplates(t);
    setSettings(s);
    setSettingsForm({
      reminders_enabled: s.reminders_enabled,
      lead_times_min: s.lead_times_min,
      max_per_appointment: s.max_per_appointment,
      default_channel: s.default_channel,
      custom_lead: "",
    });
    setLog(l);
    setSendForm((f) => ({
      ...f,
      appointment_id: f.appointment_id || a[0]?.id || "",
      customer_id: f.customer_id || c[0]?.id || "",
    }));
  }

  useEffect(() => {
    void reload()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === sendForm.template_id) || null,
    [templates, sendForm.template_id],
  );

  useEffect(() => {
    if (selectedTemplate) {
      setSendForm((f) => ({ ...f, body: selectedTemplate.body }));
    }
  }, [selectedTemplate]);

  // Live preview — "jak zobaczy klient"
  useEffect(() => {
    const body = sendForm.body.trim();
    if (!body) {
      setPreview("");
      return;
    }
    const apptId =
      targetMode === "appointment" ? sendForm.appointment_id : undefined;
    const timer = window.setTimeout(() => {
      notificationsApi
        .preview(body, apptId || undefined)
        .then((r) => setPreview(r.rendered))
        .catch(() => setPreview(body));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [sendForm.body, sendForm.appointment_id, targetMode]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await notificationsApi.send({
        appointment_id:
          targetMode === "appointment" ? sendForm.appointment_id : undefined,
        customer_id:
          targetMode === "customer" ? sendForm.customer_id : undefined,
        channel: sendForm.channel || undefined,
        body: sendForm.body,
      });
      push({
        title: "Powiadomienie wysłane",
        message: "Wpis pojawił się w logu poniżej.",
        tone: "canary",
      });
      setLog(await notificationsApi.log(50));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd wysyłki");
    } finally {
      setSending(false);
    }
  }

  function toggleLead(minutes: number) {
    setSettingsForm((f) => ({
      ...f,
      lead_times_min: f.lead_times_min.includes(minutes)
        ? f.lead_times_min.filter((m) => m !== minutes)
        : [...f.lead_times_min, minutes].sort((a, b) => b - a),
    }));
  }

  function addCustomLead() {
    const minutes = Number(settingsForm.custom_lead);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 7 * 24 * 60) {
      setError("Własny czas: podaj 5–10080 minut");
      return;
    }
    setError(null);
    setSettingsForm((f) => ({
      ...f,
      custom_lead: "",
      lead_times_min: f.lead_times_min.includes(minutes)
        ? f.lead_times_min
        : [...f.lead_times_min, minutes].sort((a, b) => b - a),
    }));
  }

  async function onSaveSettings() {
    setError(null);
    setSavingSettings(true);
    try {
      const s = await notificationsApi.updateSettings({
        reminders_enabled: settingsForm.reminders_enabled,
        lead_times_min: settingsForm.lead_times_min,
        max_per_appointment: settingsForm.max_per_appointment,
        default_channel: settingsForm.default_channel,
      });
      setSettings(s);
      push({
        title: "Zapisano ustawienia",
        message: "Reguły automatycznych przypomnień zaktualizowane.",
        tone: "canary",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu ustawień");
    } finally {
      setSavingSettings(false);
    }
  }

  function openTemplateCreate() {
    setEditingTemplate(null);
    setTemplateForm({ name: "", kind: "custom", body: "" });
    setShowTemplateForm(true);
  }

  function openTemplateEdit(t: NotificationTemplate) {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, kind: t.kind, body: t.body });
    setShowTemplateForm(true);
  }

  async function onSaveTemplate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingTemplate) {
        await notificationsApi.updateTemplate(editingTemplate.id, templateForm);
      } else {
        await notificationsApi.createTemplate(templateForm);
      }
      setShowTemplateForm(false);
      setTemplates(await notificationsApi.templates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu szablonu");
    }
  }

  async function onDeleteTemplate(id: string) {
    if (!confirm("Usunąć szablon?")) return;
    await notificationsApi.removeTemplate(id);
    setTemplates(await notificationsApi.templates());
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="animate-pulse text-sm text-[var(--muted)]">
          Ładowanie powiadomień…
        </p>
      </div>
    );
  }

  if (!["send", "reminders", "templates", "log"].includes(active)) {
    return <Navigate to="/notifications/send" replace />;
  }

  const titles: Record<string, { h: string; s: string }> = {
    send: { h: "Wysyłka", s: "Wyślij powiadomienie do klienta lub wizyty" },
    reminders: { h: "Przypomnienia", s: "Automatyczne lead time i kanał domyślny" },
    templates: { h: "Szablony", s: "Treści SMS / e-mail / Messenger" },
    log: { h: "Historia", s: "Log wysłanych powiadomień" },
  };

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">{titles[active].h}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{titles[active].s}</p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {active === "send" && (
        <GlassCard className="animate-fade-up max-w-2xl">
          <p className="font-display text-lg font-semibold">
            Wyślij powiadomienie do klienta
          </p>
          <form className="mt-4 space-y-3" onSubmit={onSend}>
            <div className="flex flex-wrap gap-2">
              <GlassButton
                type="button"
                variant={targetMode === "appointment" ? "primary" : "ghost"}
                className="!py-1.5"
                onClick={() => setTargetMode("appointment")}
              >
                Do wizyty
              </GlassButton>
              <GlassButton
                type="button"
                variant={targetMode === "customer" ? "primary" : "ghost"}
                className="!py-1.5"
                onClick={() => setTargetMode("customer")}
                disabled={customers.length === 0}
              >
                Do klienta
              </GlassButton>
            </div>

            {targetMode === "appointment" ? (
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Wizyta</span>
                <GlassSelect
                  value={sendForm.appointment_id}
                  onChange={(e) =>
                    setSendForm((f) => ({ ...f, appointment_id: e.target.value }))
                  }
                  required
                >
                  {appointments.length === 0 && (
                    <option value="">— brak nadchodzących wizyt —</option>
                  )}
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.customer_name || "Klient") +
                        " · " +
                        (a.service_name || "Usługa") +
                        " · " +
                        new Date(a.start_at).toLocaleString("pl-PL", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                    </option>
                  ))}
                </GlassSelect>
              </label>
            ) : (
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Klient</span>
                <GlassSelect
                  value={sendForm.customer_id}
                  onChange={(e) =>
                    setSendForm((f) => ({ ...f, customer_id: e.target.value }))
                  }
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.id.slice(0, 8)}
                    </option>
                  ))}
                </GlassSelect>
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">Szablon</span>
                <GlassSelect
                  value={sendForm.template_id}
                  onChange={(e) =>
                    setSendForm((f) => ({ ...f, template_id: e.target.value }))
                  }
                >
                  <option value="">Własna treść</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({KIND_LABEL[t.kind]})
                    </option>
                  ))}
                </GlassSelect>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">Kanał</span>
                <GlassSelect
                  value={sendForm.channel}
                  onChange={(e) =>
                    setSendForm((f) => ({
                      ...f,
                      channel: e.target.value as NotificationChannel | "",
                    }))
                  }
                >
                  <option value="">
                    Domyślny ({settings ? CHANNEL_LABEL[settings.default_channel] : "…"})
                  </option>
                  {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map(
                    (ch) => (
                      <option key={ch} value={ch}>
                        {CHANNEL_LABEL[ch]}
                      </option>
                    ),
                  )}
                </GlassSelect>
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">
                Treść — możesz użyć {"{{klient}}, {{usluga}}, {{data}}, {{godzina}}, {{firma}}"}
              </span>
              <GlassTextarea
                value={sendForm.body}
                onChange={(e) =>
                  setSendForm((f) => ({
                    ...f,
                    body: e.target.value,
                    template_id: "",
                  }))
                }
                placeholder="np. Cześć {{klient}}! Przypominamy o wizycie {{data}} o {{godzina}}."
                required
              />
            </label>

            {preview && (
              <div className="rounded-soft border border-white/25 bg-glass-fill p-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)]">
                  Podgląd — jak zobaczy klient
                </p>
                <p className="mt-1.5 text-sm text-[var(--text-bright)]">{preview}</p>
              </div>
            )}

            <GlassButton type="submit" disabled={sending || !sendForm.body.trim()}>
              {sending ? "Wysyłanie…" : "Wyślij powiadomienie"}
            </GlassButton>
          </form>
        </GlassCard>
      )}

      {active === "reminders" && (
        <GlassCard className="animate-fade-up max-w-2xl">
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-lg font-semibold">
              Automatyczne przypomnienia
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={settingsForm.reminders_enabled}
              onClick={() =>
                setSettingsForm((f) => ({
                  ...f,
                  reminders_enabled: !f.reminders_enabled,
                }))
              }
              className={[
                "relative h-6 w-11 shrink-0 rounded-full border transition",
                settingsForm.reminders_enabled
                  ? "border-[var(--accent)]/50 bg-[var(--accent)]"
                  : "border-glass-border bg-glass-fill",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all",
                  settingsForm.reminders_enabled ? "left-[22px]" : "left-0.5",
                ].join(" ")}
              />
            </button>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Bot sam przypomni klientowi o wizycie w wybranych momentach
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-[var(--muted)]">Kiedy przypominać</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEAD_PRESETS.map((p) => (
                  <GlassButton
                    key={p.minutes}
                    type="button"
                    variant={
                      settingsForm.lead_times_min.includes(p.minutes)
                        ? "primary"
                        : "ghost"
                    }
                    className="!py-1.5"
                    onClick={() => toggleLead(p.minutes)}
                  >
                    {p.label} przed
                  </GlassButton>
                ))}
                {settingsForm.lead_times_min
                  .filter((m) => !LEAD_PRESETS.some((p) => p.minutes === m))
                  .map((m) => (
                    <GlassButton
                      key={m}
                      type="button"
                      variant="primary"
                      className="!py-1.5"
                      onClick={() => toggleLead(m)}
                      title="Kliknij, aby usunąć"
                    >
                      {leadLabel(m)} przed ✕
                    </GlassButton>
                  ))}
              </div>
              <div className="mt-2 flex gap-2">
                <GlassInput
                  type="number"
                  min={5}
                  max={10080}
                  placeholder="Własny czas (minuty)"
                  value={settingsForm.custom_lead}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, custom_lead: e.target.value }))
                  }
                  className="max-w-[200px]"
                />
                <GlassButton type="button" variant="subtle" onClick={addCustomLead}>
                  Dodaj
                </GlassButton>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">
                  Maks. przypomnień na wizytę
                </span>
                <GlassSelect
                  value={String(settingsForm.max_per_appointment)}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      max_per_appointment: Number(e.target.value),
                    }))
                  }
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Wyłączone" : n}
                    </option>
                  ))}
                </GlassSelect>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">Domyślny kanał</span>
                <GlassSelect
                  value={settingsForm.default_channel}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      default_channel: e.target.value as NotificationChannel,
                    }))
                  }
                >
                  {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map(
                    (ch) => (
                      <option key={ch} value={ch}>
                        {CHANNEL_LABEL[ch]}
                      </option>
                    ),
                  )}
                </GlassSelect>
              </label>
            </div>

            <p className="text-xs text-[var(--muted)]">
              SMS i e-mail działają w trybie demo (mock) — podłącz providera w
              ustawieniach backendu, aby wysyłać naprawdę.
            </p>

            <GlassButton onClick={() => void onSaveSettings()} disabled={savingSettings}>
              {savingSettings ? "Zapisywanie…" : "Zapisz ustawienia"}
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {active === "templates" && (
      <GlassCard className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold">Szablony wiadomości</p>
          <GlassButton variant="subtle" onClick={openTemplateCreate}>
            + Nowy szablon
          </GlassButton>
        </div>

        {showTemplateForm && (
          <form
            className="mt-4 grid gap-3 rounded-soft border border-glass-border bg-glass-fill p-4 sm:grid-cols-2"
            onSubmit={onSaveTemplate}
          >
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Nazwa</span>
              <GlassInput
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Typ</span>
              <GlassSelect
                value={templateForm.kind}
                onChange={(e) =>
                  setTemplateForm((f) => ({
                    ...f,
                    kind: e.target.value as NotificationKind,
                  }))
                }
              >
                {(Object.keys(KIND_LABEL) as NotificationKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </GlassSelect>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">
                Treść ({"{{klient}}, {{usluga}}, {{data}}, {{godzina}}, {{firma}}"})
              </span>
              <GlassTextarea
                value={templateForm.body}
                onChange={(e) =>
                  setTemplateForm((f) => ({ ...f, body: e.target.value }))
                }
                required
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <GlassButton type="submit">
                {editingTemplate ? "Zapisz zmiany" : "Dodaj szablon"}
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setShowTemplateForm(false)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {templates.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              Brak szablonów — dodaj pierwszy, aby przyspieszyć wysyłkę.
            </p>
          )}
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-soft border border-glass-border bg-glass-fill p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--text-bright)]">{t.name}</p>
                  <p className="text-xs text-canary/90">
                    {KIND_LABEL[t.kind]}
                    {t.is_default ? " · domyślny" : ""}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <GlassButton
                    variant="subtle"
                    className="!px-3 !py-1"
                    onClick={() => openTemplateEdit(t)}
                  >
                    Edytuj
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    className="!px-3 !py-1"
                    onClick={() => void onDeleteTemplate(t.id)}
                  >
                    Usuń
                  </GlassButton>
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{t.body}</p>
            </div>
          ))}
        </div>
      </GlassCard>
      )}

      {active === "log" && (
      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Log wysłanych powiadomień</p>
        {log.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Jeszcze nic nie wysłano. Użyj formularza powyżej albo poczekaj na
            automatyczne przypomnienie.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 rounded-soft border border-glass-border bg-glass-fill px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[var(--text-bright)]">{entry.body}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {entry.customer_name || "Klient"}
                    {entry.service_name ? ` · ${entry.service_name}` : ""}
                    {" · "}
                    {new Date(entry.created_at).toLocaleString("pl-PL")}
                    {entry.lead_time_min != null &&
                      ` · auto ${leadLabel(entry.lead_time_min)} przed`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="rounded-lg border border-glass-border px-2 py-0.5 text-[var(--muted)]">
                    {CHANNEL_LABEL[entry.channel]}
                  </span>
                  <span
                    className={
                      entry.status === "sent"
                        ? "rounded-lg border border-white/40 px-2 py-0.5 text-canary"
                        : "rounded-lg border border-red-400/40 px-2 py-0.5 text-[var(--danger)]"
                    }
                  >
                    {entry.status === "sent" ? "Wysłano" : "Błąd"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      )}
    </div>
  );
}
