'use client';
import { useId, useState } from 'react';
import type { Damage } from '@/lib/types';
import { CarImage } from './vehicle-identity';
import type { Vehicle } from '@/lib/types';

/* Yükleme göstergeleri. Araç görselleri modele özel illüstrasyonlardan gelir (vehicle-identity). */

/** Üstten görünüşte daire çizerek patinaj atan araç; yükleme göstergesi. */
export function DriftLoader({ label = 'Yükleniyor…', size = 112 }: { label?: string; size?: number }) {
  return <div className="drift" role="status" aria-live="polite">
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="38" className="drift-track" />
      <circle cx="60" cy="60" r="38" className="drift-skid" />
      <circle cx="60" cy="60" r="44" className="drift-skid outer" />
      <g className="drift-orbit">
        <g transform="translate(60 19) rotate(-28)">
          <circle className="drift-smoke s1" cx="-17" cy="-6" r="5" />
          <circle className="drift-smoke s2" cx="-21" cy="5" r="6" />
          <circle className="drift-smoke s3" cx="-27" cy="-1" r="4" />
          <rect x="-14" y="-8" width="28" height="16" rx="5" fill="var(--accent)" />
          <rect x="-3" y="-6.5" width="8" height="13" rx="2.5" fill="#1e252e" opacity=".85" />
          <rect x="-11" y="-6" width="5" height="12" rx="2" fill="#1e252e" opacity=".6" />
          <rect x="11" y="-6.5" width="2.5" height="3.5" rx="1" fill="#fff6d8" />
          <rect x="11" y="3" width="2.5" height="3.5" rx="1" fill="#fff6d8" />
          <rect x="-9" y="-10" width="6" height="3" rx="1" fill="#18191b" />
          <rect x="5" y="-10" width="6" height="3" rx="1" fill="#18191b" />
          <rect x="-9" y="7" width="6" height="3" rx="1" fill="#18191b" />
          <rect x="5" y="7" width="6" height="3" rx="1" fill="#18191b" />
        </g>
      </g>
    </svg>
    {label && <span>{label}</span>}
  </div>;
}

/** Yolda giden araç: yapay zekâ beklerken ve kısa işlemlerde. */
export function RoadLoader({ label, vehicle }: { label?: string; vehicle?: Pick<Vehicle, 'brand' | 'model' | 'year'> }) {
  return <div className="road" role="status" aria-live="polite">
    <div className="road-car"><CarImage vehicle={vehicle ?? { brand: 'Volkswagen', model: 'Golf', year: 2022 }} eager /></div>
    <div className="road-lines" aria-hidden="true" />
    {label && <span>{label}</span>}
  </div>;
}


const damageZones = [
  { id: 'Ön tampon', d: 'M83 46Q130 27 177 46L180 65H80Z', x: 130, y: 52 },
  { id: 'Kaput', d: 'M83 69H177L181 111Q130 98 79 111Z', x: 130, y: 88 },
  { id: 'Ön cam', d: 'M81 116Q130 103 179 116L166 143H94Z', x: 130, y: 128 },
  { id: 'Tavan', d: 'M95 148H165V231H95Z', x: 130, y: 187 },
  { id: 'Arka cam', d: 'M94 236H166L179 260Q130 272 81 260Z', x: 130, y: 249 },
  { id: 'Bagaj', d: 'M80 266Q130 279 180 266L177 299H83Z', x: 130, y: 286 },
  { id: 'Arka tampon', d: 'M83 304H177L174 321Q130 339 86 321Z', x: 130, y: 317 },
  { id: 'Sol ön çamurluk', d: 'M61 73 78 65 75 117 59 136 53 124V93Z', x: 63, y: 103 },
  { id: 'Sol ön kapı', d: 'M60 143 77 123 90 148V187H59Z', x: 74, y: 163 },
  { id: 'Sol arka kapı', d: 'M59 192H90V232L77 256 60 237Z', x: 74, y: 213 },
  { id: 'Sol arka çamurluk', d: 'M59 244 76 264 79 301 63 295 53 275Z', x: 64, y: 277 },
  { id: 'Sağ ön çamurluk', d: 'M199 73 182 65 185 117 201 136 207 124V93Z', x: 197, y: 103 },
  { id: 'Sağ ön kapı', d: 'M200 143 183 123 170 148V187H201Z', x: 186, y: 163 },
  { id: 'Sağ arka kapı', d: 'M201 192H170V232L183 256 200 237Z', x: 186, y: 213 },
  { id: 'Sağ arka çamurluk', d: 'M201 244 184 264 181 301 197 295 207 275Z', x: 196, y: 277 },
];

/** Bölge kimlikleri mevcut kabul kayıtlarıyla birebir uyumludur. */
export function DamageMap({ damages, onToggle, readOnly }: { damages: Damage[]; onToggle?: (area: string) => void; readOnly?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const hint = useId();
  const interactive = !readOnly && !!onToggle;
  const count = damageZones.filter(z => damages.some(d => d.area === z.id)).length;
  return <div className="heb-damage">
    <div className="heb-damage-heading"><strong>Kaporta kontrolü</strong><span>{count} / {damageZones.length} bölge</span></div>
    <p id={hint}>Üstten görünüm · yönler sürücüye göredir.{interactive ? ' Bölgeye veya adına dokunun.' : ''}</p>
    <svg viewBox="0 0 260 360" className="heb-damage-map" role="group" aria-label="Araç hasar bölgeleri" aria-describedby={hint}>
      <text x="130" y="17" textAnchor="middle" className="heb-damage-direction">↑ ÖN</text>
      <text x="130" y="354" textAnchor="middle" className="heb-damage-direction">ARKA</text>
      <text x="21" y="190" textAnchor="middle" className="heb-damage-direction" transform="rotate(-90 21 190)">SOL</text>
      <text x="239" y="190" textAnchor="middle" className="heb-damage-direction" transform="rotate(90 239 190)">SAĞ</text>
      <path d="M82 40Q130 23 178 40Q208 66 209 108V274Q203 309 178 328Q130 344 82 328Q57 309 51 274V108Q52 66 82 40Z" className="heb-damage-body" />
      {[92, 262].flatMap(y => [47, 201].map(x => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="40" rx="4" className="heb-damage-wheel" />))}
      {damageZones.map((z, i) => {
        const marked = damages.some(d => d.area === z.id);
        return <g key={z.id}>
          <path d={z.d} className={`heb-damage-zone ${marked ? 'is-marked' : ''} ${active === z.id ? 'is-active' : ''}`}
            role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={`${z.id}${marked ? ' — hasar işaretli' : ''}`} aria-pressed={interactive ? marked : undefined}
            onMouseEnter={() => setActive(z.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(z.id)} onBlur={() => setActive(null)}
            onClick={() => interactive && onToggle(z.id)} onKeyDown={e => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(z.id) } }}><title>{z.id}</title></path>
          <text x={z.x} y={z.y + 4} textAnchor="middle" className={`heb-damage-number ${marked ? 'is-marked' : ''}`} aria-hidden="true">{marked ? '✓' : i + 1}</text>
        </g>;
      })}
      <g className="heb-damage-details" aria-hidden="true"><path d="M66 172v10m0 22v10m128-42v10m0 22v10M93 137h74M93 240h74" /><path d="m59 137-14 3v9l14-2m142-10 14 3v9l-14-2" /></g>
    </svg>
    <div className="heb-damage-current" aria-live="polite">{active ?? (count ? `${count} bölgede hasar işaretli` : 'Hasar işaretlenmedi')}</div>
    <div className="heb-damage-legend"><span>○ Kontrol edilecek</span><span>✓ Hasar işaretli</span></div>
    <div className="heb-damage-options">{damageZones.map((z, i) => {
      const marked = damages.some(d => d.area === z.id);
      return <button key={z.id} type="button" disabled={!interactive} aria-pressed={marked} className={marked ? 'is-marked' : ''} onClick={() => onToggle?.(z.id)} onMouseEnter={() => setActive(z.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(z.id)} onBlur={() => setActive(null)}><span>{marked ? '✓' : i + 1}</span>{z.id}</button>;
    })}</div>
  </div>;
}
