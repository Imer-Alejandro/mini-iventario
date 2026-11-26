"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "No se pudo crear el administrador.");
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
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Configura el acceso</h1>
          <p className="text-sm text-slate-500">Crea la cuenta administradora inicial. Después podrás crear usuarios y roles.</p>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Nombre
          <input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500" />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Correo electrónico
          <input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500" />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Contraseña <span className="font-normal text-slate-500">(mínimo 12 caracteres)</span>
          <input required minLength={12} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={isSubmitting} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">
          {isSubmitting ? "Configurando…" : "Crear administrador"}
        </button>
      </form>
    </main>
  );
}
