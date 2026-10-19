'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, Menu, X } from 'lucide-react';

export function Brand({ footer = false }) {
  return (
    <Link href="/" aria-label="Zetmond home" className="brand inline-flex shrink-0 items-center gap-2.5">
      <span className="brand-symbol" aria-hidden="true"><img src="/zetmond-logo.png" alt="" width="2200" height="800" /></span>
      <span className={`font-display font-bold tracking-[-.055em] text-white ${footer ? 'text-[29px]' : 'text-[26px] sm:text-[29px]'}`}>Zetmond</span>
    </Link>
  );
}

export default function SiteShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef(null);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = event => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    };
    const closeOnWideScreen = () => { if (window.innerWidth >= 1024) setMenuOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnWideScreen);
    return () => { document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', closeOnWideScreen); };
  }, [menuOpen]);
  const navigation = [['Wallet', '/#wallet'], ['The Vault', '/#how-it-works'], ['Fees', '/#fees'], ['FAQs', '/#faq']];

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-paper/90 backdrop-blur-xl">
        <div className="page-width flex h-20 items-center justify-between gap-5">
          <div className="flex items-center gap-3 xl:gap-5"><Brand /></div>
          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex xl:gap-8">
            {navigation.map(([label, href]) => <Link className="nav-link" key={href} href={href}>{label}</Link>)}
          </nav>
          <div className="hidden items-center gap-5 lg:flex">
            <button className="nav-link" type="button" disabled>Log in</button>
            <button className="button button-primary !min-h-11 !px-5 !text-[13px]" type="button" disabled>Get started <ArrowUpRight size={16} /></button>
          </div>
          <button ref={menuButton} className="grid size-11 place-items-center rounded-lg border border-white/15 bg-white/3 transition hover:bg-purple/10 lg:hidden" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)} type="button">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!menuOpen} className="border-t border-white/8 bg-paper px-6 pb-6 lg:hidden">
          <div className="flex flex-col">{navigation.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between border-b border-white/8 py-4 text-sm font-medium">{label}<ArrowUpRight size={16} className="text-muted" /></Link>)}</div>
          <div className="mt-5 flex gap-3"><button className="button button-outline flex-1" disabled type="button">Log in</button><button className="button button-primary flex-1" disabled type="button">Get started <ArrowUpRight size={16} /></button></div>
        </nav>
      </header>
      {children}
      <footer className="border-t border-white/8 bg-[#0b0a0f]">
        <div className="page-width pt-16 pb-7 lg:pt-20">
          <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-14">
            <div>
              <Brand footer />
              <p className="mt-6 max-w-64 font-display text-2xl font-semibold leading-snug tracking-tight text-white">A world of possibility.<br /><span className="text-muted">One USDT wallet.</span></p>
              <p className="mt-4 max-w-64 text-sm leading-7 text-muted">Hold, send, and trade with a clearer view of every step.</p>
            </div>
            <div><h2 className="footer-heading">PRODUCT</h2><div className="footer-links"><Link href="/#wallet">USDT wallet</Link><Link href="/#how-it-works">The two-sided Vault</Link><Link href="/#fees">Fees & funding windows</Link><button type="button" disabled>Get started <ArrowUpRight size={13} /></button></div></div>
            <div><h2 className="footer-heading">RESOURCES</h2><div className="footer-links"><Link href="/vault-policy">Vault & fee rules</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/#faq">Common questions</Link></div></div>
            <div><h2 className="footer-heading">GET STARTED</h2><div className="footer-links"><button type="button" disabled>Create an account <ArrowUpRight size={13} /></button><Link href="/#how-it-works">How trading works</Link></div><p className="mt-5 max-w-52 text-xs leading-6 text-muted">Understand the fees, funding windows, and settlement process before your first trade.</p></div>
          </div>
          <div className="mt-6 rounded-xl border border-white/7 bg-white/2 px-4 py-3 text-[11px] leading-6 text-muted"><span className="font-semibold text-ink">Built for clear settlement.</span> Zetmond brings together wallet balance, funding checks, and payout flow so customers can move with confidence.</div>
          <div className="flex flex-col justify-between gap-3 pt-6 text-[11px] leading-5 text-muted sm:flex-row"><p>© 2026 Zetmond.</p><p className="flex items-center gap-2"><ArrowDownRight size={13} className="text-purple" /> Transparent fees. Faster trade flow.</p></div>
        </div>
      </footer>
    </>
  );
}
