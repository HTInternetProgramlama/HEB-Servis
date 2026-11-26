/** HEB: atölye köprüsü, yol çizgisi ve ileri hareketten oluşan özgün amblem. */
export function BrandLogo({ light = false }: { light?: boolean }) {
  return <span className={`logo heb-brand ${light ? 'light' : ''}`}>
    <svg className="logo-mark" viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
      <path d="M12 3h24l10 10v22L36 45H12L2 35V13Z" fill="var(--accent, #d9480f)" />
      <path d="M11 13h7v8h12v-8h7v23h-7v-9H18v9h-7Z" fill="#fff" />
      <path d="m21 7 3-3 3 3v10h-6zm0 24h6v10h-6z" fill="#fff" opacity=".65" />
    </svg>
    <span className="logo-text"><b>HEB</b> Servis</span>
  </span>;
}

export { BrandLogo as Logo };
