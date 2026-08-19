/** Mockup screen 03 — the broadcasting sweep. CSS animation, no JS. */
export function Radar({ size = 220 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="mx-auto">
      <svg viewBox="0 0 220 220" className="size-full" aria-hidden>
        <defs>
          <radialGradient id="radar-sweep" cx="0%" cy="0%" r="100%">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {[30, 60, 90, 108].map((r) => (
          <circle key={r} cx="110" cy="110" r={r} fill="none" stroke="var(--grid)" strokeWidth="1" />
        ))}

        <g className="animate-sweep">
          <path d="M110,110 L110,4 A106,106 0 0,1 195,50 Z" fill="url(#radar-sweep)" />
        </g>

        <circle
          cx="110"
          cy="110"
          r="6"
          fill="var(--signal)"
          style={{ filter: "drop-shadow(0 0 8px var(--signal))" }}
        />
      </svg>
    </div>
  );
}
