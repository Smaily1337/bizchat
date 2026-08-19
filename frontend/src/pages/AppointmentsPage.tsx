import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  appointmentsApi,
  customersApi,
  notificationsApi,
  servicesApi,
  staffApi,
} from "@/api";
import type { Appointment, Customer, Service, StaffMember } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  confirmed: "Potwierdzona",
  cancelled: "Anulowana",
  completed: "Zakończona",
  no_show: "Nieobecność",
};

const FALLBACK_REMINDER =
  "Cześć {{klient}}! Przypominamy o wizycie ({{usluga}}) w {{firma}} dnia {{data}} o {{godzina}}. Do zobaczenia!";

export function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const { push } = useToast();
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [items, setItems] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    staff_id: "",
    start_at: "",
    status: "confirmed",
    notes: "",
    new_customer_name: "",
    new_customer_phone: "",
    new_customer_email: "",
  });

  async function reload() {
    const [a, s, c, st] = await Promise.all([
      appointmentsApi.list(),
      servicesApi.list(),
      customersApi.list(),
      staffApi.list().catch(() => [] as StaffMember[]),
    ]);
    setItems(a);
    setServices(s);
    setCustomers(c);
    setStaff(st.filter((x) => x.is_active));
    if (!form.service_id && s[0]) {
      setForm((f) => ({ ...f, service_id: s[0].id, customer_id: c[0]?.id || "" }));
    }
  }

  useEffect(() => {
    void reload()
      .then(() => {
        const editId = searchParams.get("edit");
        if (editId) {
          setItems((prev) => {
            const found = prev.find((a) => a.id === editId);
            if (found) openEdit(found);
            return prev;
          });
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function openCreate() {
    setEditing(null);
    setClientMode(customers.length > 0 ? "existing" : "new");
    const local = new Date();
    local.setMinutes(0, 0, 0);
    local.setHours(local.getHours() + 1);
    setForm({
      customer_id: customers[0]?.id || "",
      service_id: services[0]?.id || "",
      staff_id: "",
      start_at: local.toISOString().slice(0, 16),
      status: "confirmed",
      notes: "",
      new_customer_name: "",
      new_customer_phone: "",
      new_customer_email: "",
    });
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditing(a);
    setClientMode("existing");
    setForm({
      customer_id: a.customer_id,
      service_id: a.service_id,
      staff_id: a.staff_id || "",
      start_at: new Date(a.start_at).toISOString().slice(0, 16),
      status: a.status,
      notes: a.notes || "",
      new_customer_name: "",
      new_customer_phone: "",
      new_customer_email: "",
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let customerId = form.customer_id;
      if (!editing) {
        if (clientMode === "new") {
          const name = form.new_customer_name.trim();
          if (!name) {
            setError("Podaj imię i nazwisko nowego klienta");
            return;
          }
          const c = await customersApi.create({
            name,
            phone: form.new_customer_phone.trim() || undefined,
            email: form.new_customer_email.trim() || undefined,
          });
          customerId = c.id;
        } else if (!customerId) {
          setError("Wybierz klienta z listy");
          return;
        }
      }
      const start = new Date(form.start_at).toISOString();
      if (editing) {
        await appointmentsApi.update(editing.id, {
          start_at: start,
          status: form.status,
          notes: form.notes || null,
          service_id: form.service_id,
          staff_id: form.staff_id || null,
        });
      } else {
        await appointmentsApi.create({
          customer_id: customerId,
          service_id: form.service_id,
          start_at: start,
          status: form.status,
          notes: form.notes || null,
          staff_id: form.staff_id || null,
        });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    }
  }

  async function cancelAppt(id: string) {
    if (!confirm("Anulować wizytę?")) return;
    await appointmentsApi.cancel(id, "Anulowano w panelu");
    await reload();
  }

  async function notifyCustomer(a: Appointment) {
    setNotifyingId(a.id);
    try {
      const templates = await notificationsApi.templates();
      const reminder =
        templates.find((t) => t.kind === "reminder" && t.is_default) ||
        templates.find((t) => t.kind === "reminder");
      const log = await notificationsApi.send({
        appointment_id: a.id,
        template_id: reminder?.id,
        body: reminder ? undefined : FALLBACK_REMINDER,
      });
      const via = log.channel || a.channel || "kanał rezerwacji";
      if (log.status === "failed") {
        push({
          title: "Wysyłka nieudana",
          message: log.error || `Kanał: ${via}`,
          tone: "danger",
        });
      } else {
        push({
          title: "Przypomnienie wysłane",
          message: `Do: ${a.customer_name || "klient"} przez ${via}`,
          tone: "canary",
        });
      }
    } catch (err) {
      push({
        title: "Nie udało się wysłać",
        message: err instanceof Error ? err.message : "Błąd wysyłki",
        tone: "danger",
      });
    } finally {
      setNotifyingId(null);
    }
  }

  const groupedAppointments = items.reduce((acc, appt) => {
    const dateStr = new Date(appt.start_at).toLocaleDateString("pl-PL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(appt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  const getStatusColorClass = (status: string) => {
    switch(status) {
      case "confirmed": return "bg-gradient-to-b from-primary-container to-tertiary-container";
      case "completed": return "bg-gradient-to-b from-secondary-container to-secondary";
      case "cancelled": return "bg-error";
      default: return "bg-white/20";
    }
  };

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-lg-mobile md:text-display-lg font-bold">Wizyty</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Lista, dodawanie, edycja i anulowanie wizyt
          </p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center gap-2 bg-gradient-to-r from-primary-container to-tertiary-container text-white px-6 py-3 rounded-full hover:shadow-glow transition-all font-label-caps text-label-caps"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nowa wizyta
        </button>
      </header>

      {error && <p className="text-sm text-error">{error}</p>}

      {showForm && (
        <div className="glass-panel rounded-[28px] p-6 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl font-semibold">
              {editing ? "Edytuj wizytę" : "Nowa wizyta"}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-on-surface-variant hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            {!editing && (
              <div className="space-y-3 sm:col-span-2 bg-surface-container/30 border border-white/5 rounded-xl p-4">
                <div className="flex flex-wrap gap-2">
                  <GlassButton
                    type="button"
                    variant={clientMode === "existing" ? "primary" : "ghost"}
                    className="!py-1.5"
                    onClick={() => {
                      setClientMode("existing");
                      setForm((f) => ({
                        ...f,
                        new_customer_name: "",
                        new_customer_phone: "",
                        new_customer_email: "",
                      }));
                    }}
                    disabled={customers.length === 0}
                  >
                    Istniejący klient
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant={clientMode === "new" ? "primary" : "ghost"}
                    className="!py-1.5"
                    onClick={() => {
                      setClientMode("new");
                      setForm((f) => ({ ...f, customer_id: "" }));
                    }}
                  >
                    Nowy klient
                  </GlassButton>
                </div>
                {clientMode === "existing" ? (
                  <label className="block space-y-1 text-sm">
                    <span className="text-on-surface-variant font-label-caps text-label-caps">Wybierz z listy</span>
                    <GlassSelect
                      value={form.customer_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, customer_id: e.target.value }))
                      }
                      required
                    >
                      <option value="">— wybierz klienta —</option>
                      {customers.map((c) => (
                         <option key={c.id} value={c.id}>
                           {c.name || c.id.slice(0, 8)}
                         </option>
                      ))}
                    </GlassSelect>
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm sm:col-span-2">
                      <span className="text-on-surface-variant font-label-caps text-label-caps">Imię i nazwisko</span>
                      <GlassInput
                        value={form.new_customer_name}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            new_customer_name: e.target.value,
                          }))
                        }
                        placeholder="np. Anna Kowalska"
                        required
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="text-on-surface-variant font-label-caps text-label-caps">Telefon (opcjonalnie)</span>
                      <GlassInput
                        type="tel"
                        value={form.new_customer_phone}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            new_customer_phone: e.target.value,
                          }))
                        }
                        placeholder="np. +48 123 456 789"
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="text-on-surface-variant font-label-caps text-label-caps">E-mail (opcjonalnie)</span>
                      <GlassInput
                        type="email"
                        value={form.new_customer_email}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            new_customer_email: e.target.value,
                          }))
                        }
                        placeholder="np. anna@example.com"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
            
            <label className="space-y-1 text-sm">
              <span className="text-on-surface-variant flex items-center gap-1 font-label-caps text-label-caps">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                Usługa
              </span>
              <GlassSelect
                value={form.service_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_id: e.target.value }))
                }
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_min} min)
                  </option>
                ))}
              </GlassSelect>
            </label>
            
            {staff.length > 0 && (
              <label className="space-y-1 text-sm">
                <span className="text-on-surface-variant flex items-center gap-1 font-label-caps text-label-caps">
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  Specjalista
                </span>
                <GlassSelect
                  value={form.staff_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_id: e.target.value }))
                  }
                >
                  <option value="">Bez przypisania</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </GlassSelect>
              </label>
            )}
            
            <label className="space-y-1 text-sm">
              <span className="text-on-surface-variant flex items-center gap-1 font-label-caps text-label-caps">
                <span className="material-symbols-outlined text-[16px]">event</span>
                Start
              </span>
              <GlassInput
                type="datetime-local"
                value={form.start_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_at: e.target.value }))
                }
                required
              />
            </label>
            
            <label className="space-y-1 text-sm">
              <span className="text-on-surface-variant font-label-caps text-label-caps">Status</span>
              <GlassSelect
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </GlassSelect>
            </label>
            
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-on-surface-variant font-label-caps text-label-caps">Notatki</span>
              <GlassTextarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="min-h-[100px]"
              />
            </label>
            
            <div className="flex gap-3 sm:col-span-2 pt-2">
              <button 
                type="submit" 
                className="bg-primary text-on-surface px-6 py-2 rounded-lg font-label-caps text-label-caps hover:bg-primary-container hover:shadow-glow transition-all"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-surface-container/50 text-on-surface px-6 py-2 rounded-lg font-label-caps text-label-caps hover:bg-white/10 transition-all border border-white/10"
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {items.length === 0 && (
          <div className="glass-panel rounded-[28px] p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">event_busy</span>
            <p className="text-sm text-on-surface-variant">Brak wizyt. Zaplanuj nową wizytę.</p>
          </div>
        )}
        
        {Object.entries(groupedAppointments).map(([date, appts]) => (
          <div key={date} className="glass-panel rounded-[28px] overflow-hidden">
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md capitalize">{date}</h3>
              <span className="bg-surface-container px-3 py-1 rounded-full text-sm font-data-mono">{appts.length}</span>
            </div>
            
            <div className="p-4 flex flex-col gap-3">
              {appts.map((a) => (
                <div
                  key={a.id}
                  className="glass-card rounded-xl p-4 relative overflow-hidden flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between hover:border-white/20 hover:shadow-glow transition-all bg-surface-container/40"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColorClass(a.status)}`}></div>
                  
                  <div className="flex items-center gap-4 pl-2">
                    <div className="flex flex-col items-center justify-center min-w-[70px]">
                      <span className="font-data-mono text-data-mono text-primary">
                        {new Date(a.start_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs text-on-surface-variant font-data-mono">
                        {new Date(a.end_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    
                    <div className="h-10 w-px bg-white/10 mx-2 hidden sm:block"></div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-surface-container px-2 py-0.5 rounded text-[10px] font-label-caps text-label-caps uppercase text-on-surface-variant border border-white/5">
                          {STATUS_LABEL[a.status] || a.status}
                        </span>
                        {a.channel && (
                          <span className="bg-surface-container px-2 py-0.5 rounded text-[10px] font-label-caps text-label-caps uppercase text-primary border border-primary/20">
                            {a.channel}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[18px] text-tertiary">person</span>
                        <p className="font-display text-base font-medium">
                          {a.customer_name || "Nieznany klient"}
                        </p>
                      </div>
                      
                      <p className="text-sm text-on-surface-variant flex items-center gap-1.5 font-data-mono">
                        <span className="material-symbols-outlined text-[16px]">design_services</span>
                        {a.service_name || "Brak usługi"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-primary"
                      onClick={() => void notifyCustomer(a)}
                      disabled={a.status === "cancelled" || notifyingId === a.id}
                      title="Powiadom klienta"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {notifyingId === a.id ? "sync" : "notifications"}
                      </span>
                    </button>
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => openEdit(a)}
                      disabled={a.status === "cancelled"}
                      title="Edytuj wizytę"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container hover:bg-error/20 hover:text-error hover:border-error/30 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => void cancelAppt(a.id)}
                      disabled={a.status === "cancelled"}
                      title="Anuluj wizytę"
                    >
                      <span className="material-symbols-outlined text-[20px]">cancel</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
