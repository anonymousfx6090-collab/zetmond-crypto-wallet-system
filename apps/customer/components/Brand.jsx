import Link from "next/link";

// The same asset and symbol framing used by marketing/components/SiteShell.jsx.
export default function Brand({ href = "/login" }) {
  return (
    <Link href={href} className="brand" aria-label="Zetmond home">
      <span className="brand-symbol" aria-hidden="true">
        <img src="/zetmond-logo.png" alt="" width="2200" height="800" />
      </span>
      <span className="brand-name">Zetmond</span>
    </Link>
  );
}
