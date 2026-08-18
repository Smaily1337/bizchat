import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { tasksApi, usersApi } from "@/api";
import type { Owner, Task, TaskPriority, TaskStatus, UserRole } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Niska",
  normal: "Normalna",
  high: "Wysoka",
  urgent: "Pilna",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Otwarte",
  done: "Zrobione",
  cancelled: "Anulowane",
};

function personLabel(p: { name?: string | null; email: string }) {
  return p.name?.trim() || p.email;
}

function formatWhen(iso: string | null) {
  if (!iso) return "bez terminu";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priorityClass(p: TaskPriority) {
  if (p === "urgent") return "text-[var(--danger)]";
  if (p === "high") return "text-orange-300";
  if (p === "low") return "text-[var(--muted)]";
  return "text-canary";
}

export function TasksPage() {
  const { owner } = useAuth();
  const isAdmin = owner?.role === "owner" || owner?.role === "admin";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Owner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | TaskStatus>("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "normal" as TaskPriority,
    due_at: "",
    assignee_ids: [] as string[],
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [empForm, setEmpForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "pracownik" as UserRole,
  });

  const reload = useCallback(async () => {
    const list = await tasksApi.list({
      status: statusFilter || undefined,
      assignee_id: isAdmin ? assigneeFilter || undefined : undefined,
      overdue: overdueOnly ? true : undefined,
    });
    setTasks(list);
  }, [assigneeFilter, isAdmin, overdueOnly, statusFilter]);

  const reloadStaff = useCallback(async () => {
    if (!isAdmin) return;
    setStaff(await usersApi.list());
  }, [isAdmin]);

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [reload]);

  useEffect(() => {
    void reloadStaff().catch((e: Error) => setError(e.message));
  }, [reloadStaff]);

  const activeStaff = useMemo(
    () => staff.filter((u) => u.is_active),
    [staff],
  );

  function toggleAssignee(id: string) {
    setForm((prev) => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(id)
        ? prev.assignee_ids.filter((x) => x !== id)
        : [...prev.assignee_ids, id],
    }));
  }

  async function onCreateTask(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (form.assignee_ids.length === 0) {
      setError("Wybierz przynajmniej jednego pracownika");
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.append("title", form.title.trim());
      data.append("description", form.description.trim());
      data.append("priority", form.priority);
      if (form.due_at) {
        data.append("due_at", new Date(form.due_at).toISOString());
      }
      for (const id of form.assignee_ids) {
        data.append("assignee_ids", id);
      }
      if (files) {
        for (const file of Array.from(files)) {
          data.append("files", file);
        }
      }
      await tasksApi.create(data);
      setForm({
        title: "",
        description: "",
        priority: "normal",
        due_at: "",
        assignee_ids: [],
      });
      setFiles(null);
      const input = document.getElementById("task-files") as HTMLInputElement | null;
      if (input) input.value = "";
      setMsg("Zadanie utworzone — mail poszedł do przydzielonych osób");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateEmployee(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      await usersApi.create(empForm);
      setEmpForm({ name: "", email: "", password: "", role: "pracownik" });
      setMsg("Pracownik dodany — możesz go od razu przydzielić do zadania");
      await reloadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(task: Task, status: TaskStatus) {
    setError(null);
    try {
      await tasksApi.update(task.id, { status });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function removeTask(task: Task) {
    if (!confirm(`Usunąć zadanie „${task.title}”?`)) return;
    setError(null);
    try {
      await tasksApi.remove(task.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  const openCount = tasks.filter((t) => t.status === "open").length;
  const overdueCount = tasks.filter((t) => t.is_overdue).length;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">
          {isAdmin ? "Zadania" : "Moje zadania"}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {isAdmin
            ? "Przydziel pracę, ustaw termin i ważność. System od razu wysyła e-mail do pracownika — z informacją, od kogo jest zadanie."
            : "Tu widać robotę przydzieloną Tobie. Oznacz, gdy skończysz."}
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Otwarte: {openCount}
          {overdueCount > 0 ? ` · po terminie: ${overdueCount}` : ""}
        </p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="animate-fade-up">
            <p className="font-display text-lg font-semibold">Nowe zadanie</p>
            <form className="mt-4 space-y-3" onSubmit={onCreateTask}>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Tytuł</span>
                <GlassInput
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  maxLength={255}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Opis</span>
                <GlassTextarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--muted)]">Ważność</span>
                  <GlassSelect
                    value={form.priority}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                  >
                    {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </GlassSelect>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--muted)]">Na kiedy</span>
                  <GlassInput
                    type="datetime-local"
                    value={form.due_at}
                    onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                  />
                </label>
              </div>
              <div className="space-y-2 text-sm">
                <span className="text-[var(--muted)]">Pracownicy</span>
                {activeStaff.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Najpierw dodaj pracownika obok albo na stronie Pracownicy.
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {activeStaff.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded-xl border border-glass-border bg-glass-fill px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={form.assignee_ids.includes(u.id)}
                          onChange={() => toggleAssignee(u.id)}
                        />
                        <span className="truncate">
                          {personLabel(u)}
                          <span className="block text-[11px] text-[var(--muted)]">
                            {u.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Załączniki (opcjonalnie)</span>
                <input
                  id="task-files"
                  type="file"
                  multiple
                  className="block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-canary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-graphite"
                  onChange={(e) => setFiles(e.target.files)}
                />
              </label>
              <GlassButton type="submit" disabled={busy}>
                Przydziel i wyślij maila
              </GlassButton>
            </form>
          </GlassCard>

          <GlassCard className="animate-fade-up">
            <p className="font-display text-lg font-semibold">Nowy pracownik</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Dostanie konto do panelu pracowniczego i będzie mógł dostawać zadania na e-mail.
            </p>
            <form className="mt-4 space-y-3" onSubmit={onCreateEmployee}>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Imię</span>
                <GlassInput
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">E-mail</span>
                <GlassInput
                  type="email"
                  required
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Hasło startowe</span>
                <GlassInput
                  type="password"
                  required
                  minLength={6}
                  value={empForm.password}
                  onChange={(e) =>
                    setEmpForm({ ...empForm, password: e.target.value })
                  }
                />
              </label>
              <GlassButton type="submit" disabled={busy}>
                Dodaj pracownika
              </GlassButton>
              <p className="text-xs text-[var(--muted)]">
                Pełna lista, role i reset hasła:{" "}
                <Link to="/users" className="text-canary underline underline-offset-2">
                  Pracownicy
                </Link>
              </p>
            </form>
          </GlassCard>
        </div>
      )}

      <GlassCard className="animate-fade-up" padding="sm">
        <div className="flex flex-wrap items-end gap-3 p-2">
          <label className="space-y-1 text-xs">
            <span className="text-[var(--muted)]">Status</span>
            <GlassSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | TaskStatus)}
            >
              <option value="">Wszystkie</option>
              <option value="open">Otwarte</option>
              <option value="done">Zrobione</option>
              <option value="cancelled">Anulowane</option>
            </GlassSelect>
          </label>
          {isAdmin && (
            <label className="space-y-1 text-xs">
              <span className="text-[var(--muted)]">Osoba</span>
              <GlassSelect
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
              >
                <option value="">Wszyscy</option>
                {activeStaff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {personLabel(u)}
                  </option>
                ))}
              </GlassSelect>
            </label>
          )}
          <label className="flex items-center gap-2 pb-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            Tylko po terminie
          </label>
        </div>
      </GlassCard>

      <div className="space-y-3">
        {tasks.map((task) => (
          <GlassCard key={task.id} className="animate-fade-up">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold">{task.title}</p>
                  <span className={`text-xs font-semibold ${priorityClass(task.priority)}`}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                  <span className="rounded-lg border border-glass-border px-2 py-0.5 text-[11px] text-[var(--muted)]">
                    {STATUS_LABEL[task.status]}
                  </span>
                  {task.is_overdue && (
                    <span className="text-[11px] font-semibold text-[var(--danger)]">
                      po terminie
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
                    {task.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Termin: {formatWhen(task.due_at)}
                  {task.created_by
                    ? ` · od ${personLabel(task.created_by)}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Osoby:{" "}
                  {task.assignees.map((a) => personLabel(a)).join(", ") || "—"}
                </p>
                {task.assignees.some((a) => a.mail_status === "failed") && (
                  <p className="mt-1 text-xs text-[var(--danger)]">
                    Mail nie doszedł do:{" "}
                    {task.assignees
                      .filter((a) => a.mail_status === "failed")
                      .map((a) => personLabel(a))
                      .join(", ")}
                  </p>
                )}
                {task.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {task.attachments.map((att) => (
                      <GlassButton
                        key={att.id}
                        variant="ghost"
                        className="!px-3 !py-1 text-xs"
                        onClick={() =>
                          void tasksApi
                            .download(task.id, att.id, att.filename)
                            .catch((e: Error) => setError(e.message))
                        }
                      >
                        {att.filename}
                      </GlassButton>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {task.status !== "done" && (
                  <GlassButton
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => void setStatus(task, "done")}
                  >
                    Zrobione
                  </GlassButton>
                )}
                {task.status === "done" && (
                  <GlassButton
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => void setStatus(task, "open")}
                  >
                    Otwórz ponownie
                  </GlassButton>
                )}
                {isAdmin && task.status !== "cancelled" && (
                  <GlassButton
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => void setStatus(task, "cancelled")}
                  >
                    Anuluj
                  </GlassButton>
                )}
                {isAdmin && (
                  <GlassButton
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs text-[var(--danger)]"
                    onClick={() => void removeTask(task)}
                  >
                    Usuń
                  </GlassButton>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            {isAdmin
              ? "Brak zadań. Dodaj pracownika i przydziel pierwszą robotę."
              : "Nie masz jeszcze żadnych zadań."}
          </p>
        )}
      </div>
    </div>
  );
}
