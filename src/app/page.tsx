export default function Page() {
  return (
    <section className="card space-y-4">
      <h1 className="text-2xl md:text-3xl font-semibold">Welcome 👋</h1>
      <p className="text-[color:var(--muted)]">This is a modular starter. Use the top nav to explore.</p>
      <ul className="list-disc pl-6 text-sm space-y-1 text-[color:var(--muted)]">
        <li>Pages are defined once in <code>lib/routes.ts</code>.</li>
        <li>Blog uses simple Markdown via <code>marked</code>.</li>
        <li>Styling: Tailwind CSS.</li>
      </ul>
    </section>
  );
}