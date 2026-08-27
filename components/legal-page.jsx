import Link from "next/link";

export default function LegalPage({ title, intro, sections }) {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-32 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-primary hover:underline">
          &larr; Back to FinGenie
        </Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-4 leading-7 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                {section.content}
              </p>
            </section>
          ))}
        </div>
        <p className="mt-12 text-xs text-muted-foreground">
          Last updated: August 27, 2026
        </p>
      </article>
    </main>
  );
}
