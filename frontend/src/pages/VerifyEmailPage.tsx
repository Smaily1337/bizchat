import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "@/api";
import { GlassButton, GlassCard } from "@/components/ui";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Brak tokenu weryfikacyjnego w adresie URL.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus("ok");
        setMessage(res.message);
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || "Weryfikacja nieudana");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="animate-fade-up w-full max-w-md text-center">
        <p className="text-2xl font-semibold tracking-tight">Automovia</p>
        <h1 className="mt-2 text-lg font-medium">Weryfikacja e-mail</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {status === "loading" ? "Potwierdzamy adres…" : message}
        </p>
        {status !== "loading" && (
          <Link to="/login" className="mt-6 inline-block">
            <GlassButton type="button">Przejdź do logowania</GlassButton>
          </Link>
        )}
      </GlassCard>
    </div>
  );
}
