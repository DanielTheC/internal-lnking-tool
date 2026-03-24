const LINKS = [
  { href: "#analyze", label: "Analyze" },
  { href: "#results", label: "Results" }
] as const;

export default function WorkspaceJumpNav() {
  return (
    <nav
      aria-label="On this page"
      className="rounded-lg border border-slate-800/90 bg-slate-900/50 px-3 py-2"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        On this page
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        {LINKS.map(({ href, label }) => (
          <li key={href}>
            <a
              href={href}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
