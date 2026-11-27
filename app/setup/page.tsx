"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AuthPageShell, AuthPageItem } from "@/app/components/AuthPageShell";

const setupSteps: AuthPageItem[] = [
  { title: "Tus datos", description: "Nombre y correo del administrador." },
  { title: "Seguridad", description: "Crea una contraseña segura." },
  { title: "Confirmación", description: "Revisa los datos antes de crear." },
];

const setupStepContent = [
  {
    icon: UserRound,
    title: "Crea la cuenta administradora",
    description: "Esta cuenta tendrá acceso completo a la gestión del negocio.",
  },
  {
    icon: LockKeyhole,
    title: "Protege tu acceso",
    description: "Elige una contraseña de al menos 12 caracteres.",
  },
  {
    icon: BadgeCheck,
    title: "Revisa y crea tu cuenta",
    description: "Confirma los datos del primer administrador del sistema.",
  },
];

const inputClassName = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (currentStep < setupSteps.length - 1) {
      if (currentStep === 1 && password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
      setCurrentStep((step) => step + 1);
      return;
    }

    if (password.length < 12) {
      setError("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
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

  const step = setupStepContent[currentStep];
  const StepIcon = step.icon;

  return (
    <AuthPageShell
      asideTitle="Comienza con una base segura."
      asideDescription="Configura el acceso principal y prepara Korta Business para tu equipo."
      items={setupSteps}
      activeStep={currentStep}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <StepIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">
              Configuración inicial · Paso {currentStep + 1} de {setupSteps.length}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{step.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{step.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {currentStep === 0 && (
            <div className="space-y-4">
              <label htmlFor="admin-name" className="block space-y-2 text-sm font-semibold text-slate-700">
                Nombre completo
                <input
                  id="admin-name"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  className={inputClassName}
                />
              </label>
              <label htmlFor="admin-email" className="block space-y-2 text-sm font-semibold text-slate-700">
                Correo electrónico
                <input
                  id="admin-email"
                  required
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@negocio.com"
                  className={inputClassName}
                />
              </label>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <label htmlFor="admin-password" className="block space-y-2 text-sm font-semibold text-slate-700">
                Contraseña
                <input
                  id="admin-password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 12 caracteres"
                  className={inputClassName}
                />
              </label>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className={`h-4 w-4 ${password.length >= 12 ? "text-emerald-700" : "text-slate-400"}`} />
                Usa al menos 12 caracteres para proteger la cuenta.
              </p>
              <label htmlFor="admin-confirm-password" className="block space-y-2 text-sm font-semibold text-slate-700">
                Confirmar contraseña
                <input
                  id="admin-confirm-password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Vuelve a escribir la contraseña"
                  className={inputClassName}
                />
              </label>
              {confirmPassword && (
                <p className={`flex items-center gap-2 text-xs ${
                  password === confirmPassword ? "text-emerald-700" : "text-amber-700"
                }`}>
                  {password === confirmPassword
                    ? <CircleCheck className="h-4 w-4" />
                    : <CircleAlert className="h-4 w-4" />}
                  {password === confirmPassword ? "Las contraseñas coinciden." : "Las contraseñas aún no coinciden."}
                </p>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cuenta administradora</p>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Nombre</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Correo electrónico</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Acceso</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-emerald-800">Administrador · acceso completo</dd>
                  </div>
                </dl>
              </div>
              <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-xs leading-5 text-emerald-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Este usuario inicial solo se puede crear una vez. Luego podrás administrar usuarios y permisos desde el sistema.</p>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            {currentStep > 0 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setError("");
                  setCurrentStep((stepIndex) => stepIndex - 1);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Atrás
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Creando cuenta…"
                : currentStep === setupSteps.length - 1
                  ? "Crear cuenta administradora"
                  : "Continuar"}
              {!isSubmitting && currentStep < setupSteps.length - 1 && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </form>

        <p className="text-center text-xs leading-5 text-slate-500">
          ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-emerald-800 hover:text-emerald-900">Inicia sesión</Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
