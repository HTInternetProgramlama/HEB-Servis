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
