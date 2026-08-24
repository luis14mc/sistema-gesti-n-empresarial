import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">403</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Acceso denegado</h1>
        <p className="mt-3 text-muted-foreground">
          Tu sesión es válida, pero no tienes autorización para acceder a esta vista.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Volver al dashboard
        </Link>
      </section>
    </main>
  );
}
