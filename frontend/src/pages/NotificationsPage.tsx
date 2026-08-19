import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams, Link } from "react-router-dom";
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
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard, MessengerPreview, formatTemplateText } from "@/components/ui";
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
  const active = section;
  const { push } = useToast();
  const { business } = useAuth();
  const salonName = business?.name || "Twój Salon";
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

  if (active && !["send", "reminders", "templates", "log"].includes(active)) {
    return <Navigate to="/notifications/send" replace />;
  }

  const titles: Record<string, { h: string; s: string }> = {
    send: { h: "Wysyłka", s: "Wyślij powiadomienie do klienta lub wizyty" },
    reminders: { h: "Przypomnienia", s: "Automatyczne lead time i kanał domyślny" },
    templates: { h: "Szablony", s: "Treści SMS / e-mail / Messenger" },
    log: { h: "Historia", s: "Log wysłanych powiadomień" },
  };

  const VARIABLE_CHIPS = [
    { tag: "{{klient}}", label: "Klient" },
    { tag: "{{usluga}}", label: "Usługa" },
    { tag: "{{data}}", label: "Data" },
    { tag: "{{godzina}}", label: "Godzina" },
    { tag: "{{cena}}", label: "Cena" },
    { tag: "{{firma}}", label: "Firma" },
  ];

  const selectedAppt = useMemo(
    () => appointments.find((a) => a.id === sendForm.appointment_id) || appointments[0],
    [appointments, sendForm.appointment_id]
  );
  const selectedCust = useMemo(
    () => customers.find((c) => c.id === sendForm.customer_id) || customers[0],
    [customers, sendForm.customer_id]
  );

  return (
    <div className="space-y-6">
      {active ? (
        <header className="animate-fade-up flex flex-col items-start gap-3">
          <Link to="/notifications" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text-bright)] transition-colors">
            <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Wróć do powiadomień
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold">{titles[active as keyof typeof titles].h}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{titles[active as keyof typeof titles].s}</p>
          </div>
        </header>
      ) : (
        <header className="animate-fade-up">
          <h1 className="font-display text-3xl font-bold">Powiadomienia</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Wybierz moduł powiadomień</p>
        </header>
      )}

      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
          <Link to="/notifications/send" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Wysyłka</p>
              <p className="text-sm text-[var(--muted)]">Ręczna wysyłka wiadomości</p>
            </div>
          </Link>
          <Link to="/notifications/reminders" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Przypomnienia</p>
              <p className="text-sm text-[var(--muted)]">Automatyczne SMSy</p>
            </div>
          </Link>
          <Link to="/notifications/templates" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Szablony</p>
              <p className="text-sm text-[var(--muted)]">Zarządzaj treściami</p>
            </div>
          </Link>
          <Link to="/notifications/log" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center text-gray-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Historia</p>
              <p className="text-sm text-[var(--muted)]">Log wysłanych wiadomości</p>
            </div>
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {active === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <GlassCard className="animate-fade-up lg:col-span-7">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">
                    Treść powiadomienia
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Kliknij tag, aby wstawić:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {VARIABLE_CHIPS.map((chip) => (
                    <button
                      key={chip.tag}
                      type="button"
                      onClick={() =>
                        setSendForm((f) => ({
                          ...f,
                          body: f.body + (f.body.endsWith(" ") || !f.body ? "" : " ") + chip.tag,
                        }))
                      }
                      className="rounded-control border border-glass-border bg-glass-fill px-2 py-0.5 text-[11px] text-[var(--text-bright)] transition hover:border-[var(--accent)]/50 hover:bg-glass-fill-strong"
                    >
                      + {chip.tag}
                    </button>
                  ))}
                </div>
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
                  rows={4}
                />
              </div>

              <GlassButton type="submit" disabled={sending || !sendForm.body.trim()}>
                {sending ? "Wysyłanie…" : "Wyślij powiadomienie"}
              </GlassButton>
            </form>
          </GlassCard>

          <div className="lg:col-span-5 animate-fade-up">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Podgląd na żywo (Messenger)
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live update
              </span>
            </div>
            <MessengerPreview
              body={sendForm.body}
              salonName={salonName}
              customerName={
                targetMode === "appointment"
                  ? selectedAppt?.customer_name || "Anna Kowalska"
                  : selectedCust?.name || "Anna Kowalska"
              }
              serviceName={selectedAppt?.service_name || "Strzyżenie & Modelowanie"}
              dateStr={
                selectedAppt
                  ? new Date(selectedAppt.start_at).toLocaleDateString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "25.08.2026"
              }
              timeStr={
                selectedAppt
                  ? new Date(selectedAppt.start_at).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "14:30"
              }
            />
          </div>
        </div>
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
            <div>
              <p className="font-display text-lg font-semibold">Szablony wiadomości</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Twórz wzorce wiadomości z automatycznym podglądem na żywo w stylu Messenger.
              </p>
            </div>
            {!showTemplateForm && (
              <GlassButton variant="primary" onClick={openTemplateCreate}>
                + Nowy szablon
              </GlassButton>
            )}
          </div>

          {showTemplateForm && (
            <div className="mt-6 rounded-2xl border border-glass-border bg-glass-fill p-5 shadow-lg">
              <div className="mb-4 flex items-center justify-between border-b border-glass-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 font-semibold text-xs">
                    {editingTemplate ? "✎" : "+"}
                  </span>
                  <p className="font-semibold text-[var(--text-bright)]">
                    {editingTemplate ? `Edycja: ${editingTemplate.name}` : "Utwórz nowy szablon"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplateForm(false)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--text-bright)]"
                >
                  Zamknij ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Form column */}
                <form className="lg:col-span-7 space-y-4" onSubmit={onSaveTemplate}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-[var(--muted)]">Nazwa szablonu</span>
                      <GlassInput
                        placeholder="np. Przypomnienie 24h przed"
                        value={templateForm.name}
                        onChange={(e) =>
                          setTemplateForm((f) => ({ ...f, name: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-[var(--muted)]">Kategoria / Typ</span>
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
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs font-medium text-[var(--muted)]">
                        Treść szablonu (zmienia się na żywo w oknie po prawej)
                      </span>
                      <span className="text-[11px] text-[var(--muted)]">
                        Wstaw zmienną:
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {VARIABLE_CHIPS.map((chip) => (
                        <button
                          key={chip.tag}
                          type="button"
                          onClick={() =>
                            setTemplateForm((f) => ({
                              ...f,
                              body: f.body + (f.body.endsWith(" ") || !f.body ? "" : " ") + chip.tag,
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-control border border-glass-border bg-[var(--surface-solid)] px-2.5 py-1 text-xs text-[var(--text-bright)] transition hover:border-[#0084FF]/60 hover:bg-blue-500/10 hover:text-[#0084FF]"
                        >
                          <span className="font-semibold text-[#0084FF]">+</span> {chip.tag}
                        </button>
                      ))}
                    </div>

                    <GlassTextarea
                      rows={5}
                      value={templateForm.body}
                      onChange={(e) =>
                        setTemplateForm((f) => ({ ...f, body: e.target.value }))
                      }
                      placeholder="np. Cześć {{klient}}! Przypominamy o Twojej wizycie na usługę {{usluga}} w dniu {{data}} o godzinie {{godzina}} w {{firma}}. Do zobaczenia!"
                      required
                    />
                    <p className="text-[11px] text-[var(--muted)]">
                      Podpowiedź: Wpisz zmienne w klamrach lub użyj przycisków powyżej.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <GlassButton type="submit">
                      {editingTemplate ? "Zapisz zmiany" : "Zapisz szablon"}
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

                {/* Live Preview column */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div className="mb-2 w-full flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Podgląd na żywo (Messenger)
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live update
                    </span>
                  </div>
                  <MessengerPreview
                    body={templateForm.body}
                    salonName={salonName}
                    customerName="Anna Kowalska"
                    serviceName="Strzyżenie i stylizacja"
                    dateStr="Jutro (25.08)"
                    timeStr="14:30"
                    priceStr="160 PLN"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {templates.length === 0 && (
              <div className="md:col-span-2 rounded-xl border border-glass-border bg-glass-fill p-8 text-center">
                <p className="text-sm text-[var(--muted)]">
                  Brak szablonów — kliknij „+ Nowy szablon”, aby stworzyć pierwszy wzorzec z podglądem na żywo.
                </p>
              </div>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="group flex flex-col justify-between rounded-2xl border border-glass-border bg-glass-fill p-4 transition hover:border-glass-border-strong hover:bg-glass-fill-strong"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-glass-border/40 pb-2.5">
                    <div>
                      <p className="font-semibold text-[var(--text-bright)]">{t.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="rounded-control bg-blue-500/10 px-2 py-0.5 font-medium text-blue-500">
                          {KIND_LABEL[t.kind]}
                        </span>
                        {t.is_default && (
                          <span className="text-emerald-500 font-medium">● Domyślny</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <GlassButton
                        variant="subtle"
                        className="!px-3 !py-1 !text-xs"
                        onClick={() => openTemplateEdit(t)}
                      >
                        Edytuj
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        className="!px-3 !py-1 !text-xs text-red-400 hover:text-red-300"
                        onClick={() => void onDeleteTemplate(t.id)}
                      >
                        Usuń
                      </GlassButton>
                    </div>
                  </div>

                  {/* Messenger styled preview box inside card */}
                  <div className="mt-3 rounded-xl border border-glass-border/40 bg-black/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-[#0084FF] to-[#00C6FF] text-[9px] font-bold text-white">
                        {salonName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-medium text-[var(--muted)]">
                        {salonName} · Podgląd
                      </span>
                    </div>
                    <div className="inline-block max-w-full rounded-[16px] rounded-bl-[4px] bg-gradient-to-br from-[#0084FF] to-[#0078FF] px-3.5 py-2 text-xs text-white shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                      {formatTemplateText(t.body, { firma: salonName })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[10px] text-[var(--muted)] font-mono truncate">
                  Wzorzec: {t.body}
                </div>
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
