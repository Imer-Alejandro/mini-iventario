"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 rounded-3xl border border-white bg-white/90 p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-emerald-300">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Iniciar sesión</h1>
          <p className="text-sm text-slate-500">Ingresa con tu usuario de Korta Business.</p>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Correo electrónico
          <input required autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500" />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Contraseña
          <input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={isSubmitting} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">
          {isSubmitting ? "Ingresando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
