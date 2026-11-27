"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { AuthPageShell } from "@/app/components/AuthPageShell";

const loginHighlights = [
  { title: "Ventas ágiles", description: "Registra y consulta tus ventas con claridad." },
  { title: "Inventario al día", description: "Controla existencias y movimientos." },
  { title: "Caja bajo control", description: "Revisa turnos, efectivo y cierres." },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "No se pudo iniciar sesión.");
        return;
      }
      router.replace("/");
    } catch {
      setError("No se pudo conectar con el sistema.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      asideTitle="Tu negocio, bajo control."
      asideDescription="Inicia sesión para continuar con la operación diaria de Korta Business."
      items={loginHighlights}
    >
      <div className="space-y-7">
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Bienvenido de nuevo</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Iniciar sesión</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ingresa tus datos para acceder al sistema.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label htmlFor="login-email" className="block space-y-2 text-sm font-semibold text-slate-700">
            Correo electrónico
            <span className="relative block">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                required
                autoComplete="username"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@negocio.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </span>
          </label>

          <label htmlFor="login-password" className="block space-y-2 text-sm font-semibold text-slate-700">
            Contraseña
            <span className="relative block">
              <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                required
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contraseña"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Ingresando…" : "Entrar a mi cuenta"}
            {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-center text-xs leading-5 text-slate-500">
          ¿No puedes acceder? Contacta al administrador de tu negocio.
        </p>
      </div>
    </AuthPageShell>
  );
}
