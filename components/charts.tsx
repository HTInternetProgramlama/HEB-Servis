import { fmtDate, money, moneyShort } from '@/lib/format';

/* Bağımlılıksız SVG grafikler. Renkler CSS değişkenlerinden gelir; ekranda ve yazdırmada aynı çalışır. */

export const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

/** Günlük iki seri yan yana: işlem tutarı ve tahsilat. */
export function TrendChart({ data, height = 200 }: { data: { d: string; revenue: number; collected: number }[]; height?: number }) {
  const W = 640, H = height, L = 52, B = 26, T = 10;
  const max = Math.max(...data.flatMap(x => [x.revenue, x.collected]), 1);
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const x = (i: number) => L + (i + .5) * ((W - L - 8) / data.length);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = Math.max(2, Math.min(28, (W - L - 8) / data.length * .7));
  const step = Math.ceil(data.length / 10);
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Günlük işlem tutarı ve tahsilat">
    {[0, .25, .5, .75, 1].map(f => <g key={f}><line x1={L} x2={W - 4} y1={y(top * f)} y2={y(top * f)} className="chart-grid" /><text x={L - 8} y={y(top * f) + 3.5} textAnchor="end" className="chart-axis">{moneyShort(top * f).replace(' ₺', '')}</text></g>)}
    {data.map((p, i) => <g key={p.d}>
      <title>{`${fmtDate(p.d)} · işlem ${money(p.revenue)} · tahsilat ${money(p.collected)}`}</title>
      <rect x={x(i) - bw / 2} y={y(p.revenue)} width={bw / 2} height={Math.max(0, H - B - y(p.revenue))} rx={Math.min(2, bw / 5)} className="chart-bar" />
      <rect x={x(i)} y={y(p.collected)} width={bw / 2} height={Math.max(0, H - B - y(p.collected))} rx={Math.min(2, bw / 5)} className="chart-bar alt" />
      {i % step === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-axis">{fmtDate(p.d, { day: 'numeric', month: data.length > 14 ? 'short' : undefined }).replace(/\.$/, '')}</text>}
    </g>)}
  </svg>;
}

/** Halka grafik: pay dağılımı. */
export function Donut({ data, center, sub, size = 150 }: { data: { label: string; value: number }[]; center?: string; sub?: string; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return <div className="donut">
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={data.map(d => `${d.label} ${d.value}`).join(', ')}>
      <circle cx="70" cy="70" r={r} className="donut-track" />
      {total > 0 && data.map((d, i) => {
        const len = d.value / total * c; const off = acc; acc += len;
        return d.value > 0 && <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={SERIES[i % SERIES.length]} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
      })}
      {center && <text x="70" y={sub ? 70 : 75} textAnchor="middle" className="donut-value">{center}</text>}
      {sub && <text x="70" y="88" textAnchor="middle" className="donut-sub">{sub}</text>}
    </svg>
    <ul className="legend">{data.map((d, i) => <li key={d.label}><i style={{ background: SERIES[i % SERIES.length] }} /><span>{d.label}</span><b>{total ? Math.round(d.value / total * 100) : 0}%</b></li>)}</ul>
  </div>;
}

/** Yatay çubuklar: sıralı kırılımlar. */
export function HBars({ data, format = String, max: forced }: { data: { label: string; value: number; note?: string }[]; format?: (v: number) => string; max?: number }) {
  const max = forced ?? Math.max(...data.map(d => d.value), 1);
  return <ul className="hbars">{data.map((d, i) => <li key={d.label}>
    <div className="hbars-head"><span>{d.label}</span><b>{format(d.value)}</b></div>
    <div className="hbars-track"><i style={{ width: `${d.value / max * 100}%`, background: SERIES[i % SERIES.length] }} /></div>
    {d.note && <small>{d.note}</small>}
  </li>)}</ul>;
}

/** Değişim rozeti: önceki döneme göre. */
export function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null || !isFinite(value)) return <span className="delta flat">önceki dönem yok</span>;
  const up = value >= 0, good = invert ? !up : up;
  return <span className={'delta ' + (Math.abs(value) < .005 ? 'flat' : good ? 'up' : 'down')}>{up ? '▲' : '▼'} %{Math.abs(Math.round(value * 100))}</span>;
}
