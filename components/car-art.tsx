import { useId } from 'react';
import type { Vehicle } from '@/lib/types';

/* Kod ile çizilen araç görselleri: kasa tipine ve kayıttaki renge göre yan görünüş.
   Fotoğraf veya marka çizimi değildir; listelerde aracı bir bakışta tanımak için kullanılır. */

export type BodyType = 'hatch' | 'sedan' | 'suv' | 'van';

const fold = (s: string) => s.trim().toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
const VAN = ['transit', 'doblo', 'partner', 'berlingo', 'caddy', 'kangoo', 'fiorino', 'vito', 'sprinter', 'transporter', 'connect', 'courier', 'rifter', 'combo', 'master', 'crafter', 'boxer', 'ducato', 'jumper', 'h350', 'trafic', 'proace'];
const SUV = ['duster', '3008', '2008', '5008', 'tucson', 'kuga', 'qashqai', 'rav4', 't-roc', 'tiguan', 'kadjar', 'captur', 'c-hr', 'sportage', 'kona', 'bayon', 'puma', 'juke', 'x1', 'x3', 'q3', 'q5', 'gla', 'glc', 'ix35', 'santa fe', 'sorento', 'karoq', 'kodiaq', 'arona', 'ateca', 'x-trail', 'outlander', 'hr-v', 'cr-v', 'yaris cross', 'taigo', 't-cross', 'jogger', 'austral', 'model y', 'atto 3', 'togg', 't10x', 'ec40', 'xc40', 'xc60', 'tonale', '500x', 'renegade', 'compass'];
const HATCH = ['golf', 'clio', 'i20', 'i10', 'polo', '208', 'corsa', 'yaris', 'fiesta', 'focus', 'astra', 'sandero', 'micra', 'swift', 'up', 'ibiza', 'fabia', 'a3', 'a1', '1 serisi', 'auris', 'rio', 'picanto', 'zoe', 'megane hb', 'egea hb', 'egea cross', 'tipo hb', 'leon', 'mini', 'model 3'];

export function bodyType(v: Pick<Vehicle, 'model'>): BodyType {
  const m = fold(v.model);
  const has = (list: string[]) => list.some(k => m === k || m.startsWith(k + ' ') || m.includes(k));
  if (has(VAN)) return 'van';
  if (has(SUV)) return 'suv';
  if (/sedan/.test(m)) return 'sedan';
  if (has(HATCH)) return 'hatch';
  return 'sedan';
}

const COLORS: [RegExp, string][] = [
  [/beyaz|white|inci/, '#eceae5'], [/siyah|black/, '#2b2d31'], [/gumus|silver/, '#b7bcc3'], [/gri|grey|gray|fume|antrasit/, '#7d838c'],
  [/lacivert|navy/, '#233559'], [/mavi|blue/, '#2c66c9'], [/kirmizi|red/, '#c3302a'], [/bordo/, '#7a2230'], [/yesil|green|haki/, '#2f7d55'],
  [/turuncu|orange/, '#e0661f'], [/sari|yellow/, '#e6b422'], [/kahve|bronz|brown|bej/, '#8a6448'], [/mor|purple/, '#5e3f8f'],
];
export function paint(color?: string) {
  const c = fold(color ?? '');
  return COLORS.find(([r]) => r.test(c))?.[1] ?? '#9aa0a8';
}

/* 240×100 kutuda, ön taraf sağda. Teker merkezleri 60 ve 180, yer çizgisi y=86. */
const SHAPES: Record<BodyType, { body: string; glass: string[]; wheelR: number; lamp: [number, number]; tail: [number, number]; lineY: number; x0?: number }> = {
  sedan: {
    body: 'M10 72 Q10 60 24 57 L60 53 L90 35 Q97 31 107 31 L148 31 Q158 31 167 37 L190 52 L218 56 Q231 58 231 69 L231 76 Q231 80 226 80 L203 80 A23 23 0 0 0 157 80 L83 80 A23 23 0 0 0 37 80 L15 80 Q10 80 10 76 Z',
    glass: ['M69 52 L94 37 Q99 35 105 35 L124 35 L124 52 Z', 'M129 35 L147 35 Q155 35 161 40 L180 52 L129 52 Z'],
    wheelR: 17, lamp: [222, 61], tail: [14, 62], lineY: 62,
  },
  hatch: {
    body: 'M30 72 Q28 54 34 46 L50 32 Q56 29 66 29 L140 29 Q151 29 159 35 L184 52 L214 56 Q227 58 227 69 L227 76 Q227 80 222 80 L203 80 A23 23 0 0 0 157 80 L83 80 A23 23 0 0 0 37 80 L34 80 Q30 80 30 76 Z',
    glass: ['M40 48 L52 36 Q57 33 64 33 L76 33 L75 52 L40 52 Z', 'M80 33 L122 33 L122 52 L79 52 Z', 'M127 33 L139 33 Q148 33 154 38 L174 52 L127 52 Z'],
    wheelR: 17, lamp: [218, 61], tail: [32, 55], lineY: 62, x0: 30,
  },
  suv: {
    body: 'M10 70 Q9 46 18 38 L32 25 Q38 20 50 20 L146 20 Q158 20 166 27 L188 47 L218 52 Q232 55 232 67 L232 76 Q232 80 227 80 L205 80 A25 25 0 0 0 155 80 L85 80 A25 25 0 0 0 35 80 L15 80 Q10 80 10 76 Z',
    glass: ['M22 44 L35 29 Q40 25 48 25 L64 25 L63 46 L22 46 Z', 'M69 25 L122 25 L122 46 L68 46 Z', 'M127 25 L145 25 Q154 25 160 31 L178 46 L127 46 Z'],
    wheelR: 19, lamp: [222, 57], tail: [13, 52], lineY: 58,
  },
  van: {
    body: 'M10 76 L10 22 Q10 12 21 12 L160 12 Q170 12 177 20 L198 44 L220 50 Q232 53 232 65 L232 76 Q232 80 227 80 L205 80 A24 24 0 0 0 157 80 L83 80 A24 24 0 0 0 35 80 L14 80 Q10 80 10 76 Z',
    glass: ['M165 18 Q170 18 174 23 L190 43 L150 43 L150 18 Z', 'M110 18 L145 18 L145 43 L110 43 Z'],
    wheelR: 18, lamp: [223, 56], tail: [12, 30], lineY: 54,
  },
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function Wheel({ x, r, spin }: { x: number; r: number; spin?: boolean }) {
  return <g transform={`translate(${x} 80)`}>
    <circle r={r} fill="#18191b" />
    <circle r={r * .62} fill="#c9cdd2" />
    <g className={spin ? 'car-spin' : undefined}>
      {[0, 72, 144, 216, 288].map(a => <rect key={a} x={-1.6} y={-r * .58} width={3.2} height={r * .5} rx={1.4} fill="#8f959c" transform={`rotate(${a})`} />)}
    </g>
    <circle r={r * .16} fill="#5d6268" />
  </g>;
}

export function CarArt({ vehicle, type, color, spin, className, title }: { vehicle?: Pick<Vehicle, 'model' | 'color'>; type?: BodyType; color?: string; spin?: boolean; className?: string; title?: string }) {
  const t = type ?? (vehicle ? bodyType(vehicle) : 'sedan');
  const base = color ?? paint(vehicle?.color);
  const s = SHAPES[t];
  const id = 'ca' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const light = parseInt(base.slice(1, 3), 16) > 200;
  return <svg className={'car-art ' + (className ?? '')} viewBox="0 0 242 104" role="img" aria-label={title ?? 'Araç görseli'}>
    <defs>
      <linearGradient id={id + 'b'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={shade(base, .14)} /><stop offset=".5" stopColor={base} /><stop offset="1" stopColor={shade(base, -.2)} />
      </linearGradient>
      <linearGradient id={id + 'g'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3b4654" /><stop offset=".55" stopColor="#1d242d" /><stop offset="1" stopColor="#4a5767" />
      </linearGradient>
    </defs>
    <ellipse cx="121" cy="92" rx="112" ry="7" fill="var(--car-shadow, rgba(0,0,0,.16))" />
    <path d={s.body} fill={`url(#${id}b)`} stroke={light ? '#b9b6ae' : shade(base, -.28)} strokeWidth="1.2" />
    {s.glass.map((g, i) => <path key={i} d={g} fill={`url(#${id}g)`} />)}
    <path d={`M${(s.x0 ?? 12) + 6} ${s.lineY} L226 ${s.lineY}`} stroke={shade(base, -.22)} strokeWidth="1" opacity=".55" />
    <path d={`M40 ${s.lineY + 11} L222 ${s.lineY + 11}`} stroke={shade(base, -.3)} strokeWidth="5" opacity=".35" strokeLinecap="round" />
    {t !== 'van' && <path d={`M126 ${s.lineY - 10} L126 ${s.lineY + 14}`} stroke={shade(base, -.25)} strokeWidth="1" opacity=".6" />}
    {t === 'van' && <path d="M105 18 L105 76 M148 14 L148 76" stroke={shade(base, -.25)} strokeWidth="1" opacity=".6" />}
    <rect x={s.lamp[0] - 6} y={s.lamp[1] - 3} width="12" height="6" rx="3" fill="#fff6d8" stroke="#d9c88f" strokeWidth=".8" />
    <rect x={s.tail[0] - 2} y={s.tail[1] - 3} width="7" height="8" rx="2" fill="#d23a2e" />
    <rect x="140" y={s.lineY - 6} width="9" height="2.4" rx="1.2" fill={shade(base, -.35)} opacity=".7" />
    <rect x="94" y={s.lineY - 6} width="9" height="2.4" rx="1.2" fill={shade(base, -.35)} opacity=".7" />
    <Wheel x={60} r={s.wheelR} spin={spin} />
    <Wheel x={180} r={s.wheelR} spin={spin} />
  </svg>;
}

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
export function RoadLoader({ label, vehicle }: { label?: string; vehicle?: Pick<Vehicle, 'model' | 'color'> }) {
  return <div className="road" role="status" aria-live="polite">
    <div className="road-car"><CarArt vehicle={vehicle} color={vehicle ? undefined : '#d9480f'} spin /></div>
    <div className="road-lines" aria-hidden="true" />
    {label && <span>{label}</span>}
  </div>;
}
