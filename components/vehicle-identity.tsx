'use client';
import { useState } from 'react';
import Image from 'next/image';
import { findVehicleMedia } from '@/lib/vehicle-media';
import { plateText } from '@/lib/format';
import type { Vehicle } from '@/lib/types';

export function Plate({ value, size }: { value: string; size?: 'sm' | 'lg' }) {
  const text = plateText(value);
  return <span className={'plate ' + (size ?? '')} aria-label={`Plaka ${text}`}><span className="plate-tr" aria-hidden="true">TR</span><span className="plate-no">{text}</span></span>;
}

export function BrandMark({ brand }: { brand: string }) {
  const name = brand.trim().toLocaleLowerCase('tr');
  let mark;
  if (name === 'volkswagen' || name === 'vw') mark = <><circle cx="24" cy="24" r="21" /><path d="m14 7 10 17L34 7M7 18l9 21 8-16 8 16 9-21" /></>;
  else if (name === 'renault') mark = <><path d="M24 2 41 24 24 46 7 24Z" /><path d="m20 8 12 16-12 16M28 8 16 24l12 16" /></>;
  else if (name === 'mercedes' || name === 'mercedes-benz') mark = <><circle cx="24" cy="24" r="21" /><path d="M24 4v20L7 35l17-11 17 11" /></>;
  else if (name === 'audi') mark = <>{[9, 19, 29, 39].map(x => <ellipse key={x} cx={x} cy="24" rx="8" ry="10" />)}</>;
  else if (name === 'toyota') mark = <><ellipse cx="24" cy="24" rx="22" ry="15" /><ellipse cx="24" cy="24" rx="8" ry="15" /><ellipse cx="24" cy="17" rx="17" ry="7" /></>;
  else if (name === 'fiat') mark = <text x="24" y="33" textAnchor="middle" fontSize="27" fontWeight="900" fontFamily="Arial Narrow,Arial" letterSpacing="-2" fill="currentColor" stroke="none">FIAT</text>;
  else if (name === 'ford') mark = <><ellipse cx="24" cy="24" rx="23" ry="14" /><text x="24" y="30" textAnchor="middle" fontSize="17" fontStyle="italic" fontFamily="Georgia" fill="currentColor" stroke="none">Ford</text></>;
  else if (name === 'hyundai') mark = <><ellipse cx="24" cy="24" rx="22" ry="14" /><path d="M15 16c3 5 4 12 2 17M33 15c-2 5-3 12-1 17M17 24h14" /></>;
  else mark = <text x="24" y="31" textAnchor="middle" fontSize="19" fontWeight="700" fill="currentColor" stroke="none">{brand.slice(0, 2).toLocaleUpperCase('tr')}</text>;
  return <span className="brand-mark" title={brand}><svg viewBox="0 0 48 48" role="img" aria-label={`${brand}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">{mark}</svg></span>;
}

/** Modele özel çizim (fotoğraf değil). Katalogda olmayan modeller için boş durum gösterilir. */
export function CarDrawing({ vehicle }: { vehicle: Pick<Vehicle, 'brand' | 'model' | 'year'> }) {
  const media = findVehicleMedia(vehicle);
  const [failed, setFailed] = useState('');
  if (!media || failed === media.src) return <div className="drawing-missing"><span>{vehicle.brand} {vehicle.model}</span><small>Bu model için çizim bulunmuyor</small></div>;
  return <figure className="drawing">
    <div className="drawing-crop"><Image className={'drawing-atlas tile-' + media.tile} src={media.src} width={1536} height={1024} alt={media.label + ' — model çizimi'} sizes="(max-width: 700px) 180vw, 640px" onError={() => setFailed(media.src)} /></div>
    <figcaption>{media.label} · temsili model çizimi</figcaption>
  </figure>;
}

export function VehicleCell({ vehicle, sub }: { vehicle?: Vehicle; sub?: React.ReactNode }) {
  if (!vehicle) return <span className="muted">Araç kaydı yok</span>;
  return <div className="vehicle-cell"><Plate value={vehicle.plate} size="sm" /><div><strong>{vehicle.brand} {vehicle.model}</strong><small>{sub ?? `${vehicle.year} · ${vehicle.km.toLocaleString('tr-TR')} km`}</small></div></div>;
}
