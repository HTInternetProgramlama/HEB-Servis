'use client';
import { pagesBasePath } from '@/lib/routes';
import { vehicleImage } from '@/lib/vehicle-media';
import { plateText } from '@/lib/format';
import type { Vehicle } from '@/lib/types';

export function Plate({ value, size }: { value: string; size?: 'sm' | 'lg' }) {
  const text = plateText(value);
  return <span className={'plate ' + (size ?? '')} aria-label={`Plaka ${text}`}><span className="plate-tr" aria-hidden="true">TR</span><span className="plate-no">{text}</span></span>;
}

export function BrandMark({ brand }: { brand: string }) {
  const name = brand.trim().toLocaleLowerCase('tr');
  const asset = ({ dacia: 'dacia.svg', hyundai: 'hyundai.svg', peugeot: 'peugeot.svg' } as Record<string, string>)[name];
  if (asset) return <span className="brand-mark heb-brand-asset" title={brand}>
    {/* SVG dosyaları yerel sunulur; en-boy oranı korunur. */}
    <img src={`${pagesBasePath}/brand/${asset}`} alt={brand} width={48} height={48} draggable={false} />
  </span>;
  let mark;
  if (name === 'volkswagen' || name === 'vw') mark = <><circle cx="24" cy="24" r="21" /><path d="m14 7 10 17L34 7M7 18l9 21 8-16 8 16 9-21" /></>;
  else if (name === 'renault') mark = <><path d="M24 2 41 24 24 46 7 24Z" /><path d="m20 8 12 16-12 16M28 8 16 24l12 16" /></>;
  else if (name === 'mercedes' || name === 'mercedes-benz') mark = <><circle cx="24" cy="24" r="21" /><path d="M24 4v20L7 35l17-11 17 11" /></>;
  else if (name === 'audi') mark = <>{[9, 19, 29, 39].map(x => <ellipse key={x} cx={x} cy="24" rx="8" ry="10" />)}</>;
  else if (name === 'toyota') mark = <><ellipse cx="24" cy="24" rx="22" ry="15" /><ellipse cx="24" cy="24" rx="8" ry="15" /><ellipse cx="24" cy="17" rx="17" ry="7" /></>;
  else if (name === 'fiat') mark = <text x="24" y="33" textAnchor="middle" fontSize="27" fontWeight="900" fontFamily="Arial Narrow,Arial" letterSpacing="-2" fill="currentColor" stroke="none">FIAT</text>;
  else if (name === 'ford') mark = <><ellipse cx="24" cy="24" rx="23" ry="14" /><text x="24" y="30" textAnchor="middle" fontSize="17" fontStyle="italic" fontFamily="Georgia" fill="currentColor" stroke="none">Ford</text></>;
  else mark = <text x="24" y="31" textAnchor="middle" fontSize="19" fontWeight="700" fill="currentColor" stroke="none">{brand.slice(0, 2).toLocaleUpperCase('tr')}</text>;
  return <span className="brand-mark" title={brand}><svg viewBox="0 0 48 48" role="img" aria-label={`${brand}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">{mark}</svg></span>;
}

/** Araç görseli: modele özel illüstrasyon, yoksa kasa tipine göre markasız çizim. */
export function CarImage({ vehicle, className, eager }: { vehicle: Pick<Vehicle, 'brand' | 'model' | 'year'>; className?: string; eager?: boolean }) {
  const img = vehicleImage(vehicle);
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={'car-img ' + (img.generic ? 'generic ' : '') + (className ?? '')} src={pagesBasePath + img.src} width={720} height={480} alt={img.generic ? '' : `${vehicle.brand} ${img.label}`} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />;
}

/** Büyük araç görseli ve açıklaması (iş emri, araç kartı, portal). */
export function CarDrawing({ vehicle }: { vehicle: Pick<Vehicle, 'brand' | 'model' | 'year'> }) {
  const img = vehicleImage(vehicle);
  return <figure className="drawing">
    <div className="drawing-stage"><CarImage vehicle={vehicle} eager /></div>
    <figcaption>{img.generic ? `${vehicle.brand} ${vehicle.model} · bu model için çizim yok, genel ${img.label.toLocaleLowerCase('tr')} çizimi` : `${img.label} · temsili model çizimi`}</figcaption>
  </figure>;
}

export function VehicleCell({ vehicle, sub, art = true }: { vehicle?: Vehicle; sub?: React.ReactNode; art?: boolean }) {
  if (!vehicle) return <span className="muted">Araç kaydı yok</span>;
  return <div className="vehicle-cell">
    {art && <span className="car-thumb" aria-hidden="true"><CarImage vehicle={vehicle} /></span>}
    <div><strong>{vehicle.brand} {vehicle.model}</strong><span className="vehicle-sub"><Plate value={vehicle.plate} size="sm" /><small>{sub ?? `${vehicle.year} · ${vehicle.km.toLocaleString('tr-TR')} km`}</small></span></div>
  </div>;
}
