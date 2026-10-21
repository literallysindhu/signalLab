import { useMemo } from 'react';
import { Rng } from '../engine';

/**
 * Transmitter → channel → receiver sketch. Wave amplitude shrinks with the
 * link-budget path loss, and noise speckle density follows the effective SNR.
 */
export function ChannelIllustration({
  distanceM,
  effectiveSnrDb,
  pathLossDb,
  fading,
  interference,
}: {
  distanceM: number;
  effectiveSnrDb: number;
  pathLossDb: number;
  fading: boolean;
  interference: boolean;
}) {
  const ampScale = Math.max(0.08, Math.pow(10, -pathLossDb / 40)); // visual only: softened so it stays visible
  const noiseCount = Math.round(Math.min(90, Math.max(4, 70 - effectiveSnrDb * 2.5)));
  const dots = useMemo(() => {
    const r = new Rng(7);
    return Array.from({ length: 90 }, () => ({ x: 120 + r.uniform() * 360, y: 22 + r.uniform() * 76, s: 0.8 + r.uniform() * 1.4 }));
  }, []);
  const wave = useMemo(() => {
    let d = '';
    for (let x = 0; x <= 360; x += 2) {
      const decay = 1 - (x / 360) * (1 - ampScale);
      const y = 60 - Math.sin(x / 9) * 26 * decay;
      d += `${x === 0 ? 'M' : 'L'}${120 + x},${y.toFixed(1)}`;
    }
    return d;
  }, [ampScale]);

  const quality = effectiveSnrDb >= 15 ? 'Strong' : effectiveSnrDb >= 10 ? 'Good' : effectiveSnrDb >= 5 ? 'Marginal' : 'Weak';
  const qColor = effectiveSnrDb >= 15 ? '#15803D' : effectiveSnrDb >= 10 ? '#0F766E' : effectiveSnrDb >= 5 ? '#B45309' : '#B91C1C';

  return (
    <figure className="rounded-2xl border border-line bg-white p-4">
      <svg viewBox="0 0 600 130" className="h-auto w-full" role="img" aria-label={`Transmitter to receiver over ${distanceM} metres; received signal quality ${quality.toLowerCase()}`}>
        {/* transmitter */}
        <g>
          <rect x="20" y="36" width="76" height="48" rx="10" fill="#CCFBF1" />
          <text x="58" y="64" textAnchor="middle" fontSize="13" fontWeight="600" fill="#0F766E">TX</text>
          <text x="58" y="104" textAnchor="middle" fontSize="11" fill="#64748B">Sensor</text>
        </g>
        {dots.slice(0, noiseCount).map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.s} fill="#94A3B8" opacity="0.55" />
        ))}
        {interference && <path d="M140,108 q10,-10 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0" fill="none" stroke="#F59E0B" strokeWidth="1.2" opacity="0.8" />}
        <path d={wave} fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeDasharray={fading ? '10 5' : undefined} />
        {/* receiver */}
        <g>
          <rect x="504" y="36" width="76" height="48" rx="10" fill="#EDE9FE" />
          <text x="542" y="64" textAnchor="middle" fontSize="13" fontWeight="600" fill="#7C3AED">RX</text>
          <text x="542" y="104" textAnchor="middle" fontSize="11" fill="#64748B">Receiver</text>
        </g>
        <text x="300" y="14" textAnchor="middle" fontSize="12" fill="#475569">{distanceM} m · path loss {pathLossDb.toFixed(1)} dB</text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-ink-soft">
          Signal-to-noise at receiver: <span className="font-mono font-semibold text-ink">{effectiveSnrDb.toFixed(1)} dB</span>
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ color: qColor, background: `${qColor}14` }}>
          {quality} signal
        </span>
      </figcaption>
      {(fading || interference) && (
        <p className="mt-1 text-xs text-ink-faint">
          {fading && 'Dashed wave: fading is on, so each packet gets a random gain. '}
          {interference && 'Amber line: an interfering tone is present.'}
        </p>
      )}
    </figure>
  );
}
