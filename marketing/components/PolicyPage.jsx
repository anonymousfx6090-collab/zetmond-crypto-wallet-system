import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

export default function PolicyPage({ eyebrow, title, description, children, productRules = false }) {
  return (
    <main id="main" className="page-width py-12 sm:py-20">
      <div className="mx-auto max-w-190">
        <Link href="/" className="inline-link"><ArrowLeft size={15} />Back to Zetmond</Link>
        <p className="eyebrow mt-10 text-purple">{eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.1] tracking-[-.04em] sm:text-6xl">{title}</h1>
        <p className="mt-6 max-w-160 text-base leading-8 text-muted">{description}</p>
        <div className="mt-8 flex gap-3 rounded-xl border border-purple/12 bg-lavender px-5 py-4 text-xs leading-6"><Info size={19} className="mt-0.5 shrink-0 text-purple" /><p>{productRules ? 'A product-rule summary for the product, based on PRD v1.0. Open decisions are marked TBD. This page does not establish live service terms.' : 'Draft placeholder for review. This is not an approved legal policy or a live-service agreement. Final wording must be approved before launch.'}</p></div>
        <article className="policy-content mt-10 border-t border-ink/10 pt-2">{children}</article>
        <div className="mt-12 flex flex-wrap gap-5 border-t border-ink/10 pt-6"><Link href="/terms" className="inline-link">Terms</Link><Link href="/privacy" className="inline-link">Privacy</Link><Link href="/vault-policy" className="inline-link">Vault & fee rules</Link><Link href="/#faq" className="inline-link">FAQs</Link></div>
      </div>
    </main>
  );
}
