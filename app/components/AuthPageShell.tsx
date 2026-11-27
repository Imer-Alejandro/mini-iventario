import Image from "next/image";
import { Check, CheckCircle2, Store } from "lucide-react";

export interface AuthPageItem {
  title: string;
  description: string;
}

interface AuthPageShellProps {
  children: React.ReactNode;
  asideTitle: string;
  asideDescription: string;
  items: AuthPageItem[];
  activeStep?: number;
}

export function AuthPageShell({
  children,
  asideTitle,
  asideDescription,
  items,
  activeStep,
}: AuthPageShellProps) {
  const isWizard = activeStep !== undefined;

  return (
    <main className="relative z-10 grid min-h-screen place-items-center bg-[#eef0ef] p-3 sm:p-6">
      <section className="grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_80px_-36px_rgba(11,25,44,0.28)] sm:min-h-[calc(100vh-3rem)] md:min-h-[min(760px,calc(100vh-3rem))] md:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-[#f7f8f7] px-5 py-5 sm:px-8 sm:py-7 md:min-h-[680px]">
          <div className="relative z-10">
            <div className="mb-6 inline-flex h-12 w-40 items-center overflow-hidden rounded-lg bg-white px-2">
              <Image
                src="/korta-logo.png"
                alt="Korta Business"
                width={192}
                height={128}
                priority
                className="h-12 w-36 object-cover object-[center_35%]"
              />
            </div>

            <div className="mb-5 max-w-sm">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{asideTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{asideDescription}</p>
            </div>

            <nav aria-label={isWizard ? "Pasos de configuración" : "Ventajas de Korta Business"}>
              <ol className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-0">
                {items.map((item, index) => {
                  const isCurrent = activeStep === index;
                  const isComplete = activeStep !== undefined && index < activeStep;

                  return (
                    <li
                      key={item.title}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`flex min-w-0 items-start gap-2 rounded-xl p-2.5 transition-colors lg:gap-3 lg:px-0 lg:py-3 ${
                        isCurrent ? "bg-white shadow-sm md:bg-transparent md:shadow-none" : ""
                      }`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        isCurrent
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : isComplete
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : activeStep === undefined
                              ? "border-slate-200 bg-white text-emerald-700"
                              : "border-slate-200 bg-white text-slate-400"
                      }`}>
                        {isComplete ? <Check className="h-3.5 w-3.5" /> : activeStep === undefined ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-xs font-bold sm:text-sm ${
                          isCurrent || activeStep === undefined ? "text-slate-800" : "text-slate-500"
                        }`}>
                          {item.title}
                        </span>
                        <span className="mt-0.5 hidden text-xs leading-5 text-slate-500 md:block">
                          {item.description}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          <div className="relative z-10 mt-4 hidden items-center gap-2 text-xs font-medium text-slate-500 md:flex">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            {isWizard ? "Configuración segura y de un solo uso" : "Tu operación, organizada en un solo lugar"}
          </div>
          <Store aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 hidden h-56 w-56 text-slate-900/[0.035] md:block" strokeWidth={0.8} />
        </aside>

        <div className="flex min-w-0 flex-col px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">{children}</div>
          </div>

          <div className="mt-8">
            {isWizard ? (
              <>
                <span className="sr-only">Paso {activeStep + 1} de {items.length}</span>
                <div className="mx-auto flex w-full max-w-md gap-2" aria-hidden="true">
                  {items.map((item, index) => (
                    <span
                      key={item.title}
                      className={`h-1 w-full rounded-full ${
                        index <= activeStep ? "bg-emerald-700" : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-xs font-medium text-slate-400">
                Acceso protegido · Korta Business
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
