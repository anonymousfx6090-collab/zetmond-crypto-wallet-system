'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, Menu, X } from 'lucide-react';

export function Brand({ footer = false, onClick }) {
  return (
    <Link href="/" onClick={onClick} aria-label="Zetmond home" className="brand inline-flex shrink-0 items-center gap-2.5">
      <span className="brand-symbol" aria-hidden="true"><img src="/zetmond-logo.png" alt="" width="2200" height="800" /></span>
      <span className={`font-display font-bold tracking-[-.055em] text-white ${footer ? 'text-[29px]' : 'text-[26px] sm:text-[29px]'}`}>Zetmond</span>
    </Link>
  );
}

export default function SiteShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef(null);
  const drawer = useRef(null);
  const closeButton = useRef(null);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const handleKeys = event => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); }
      if (event.key !== 'Tab') return;
      const focusable = drawer.current?.querySelectorAll('a[href], button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const closeOnWideScreen = () => { if (window.innerWidth >= 1024) setMenuOpen(false); };
    document.addEventListener('keydown', handleKeys);
    window.addEventListener('resize', closeOnWideScreen);
    return () => {
      document.removeEventListener('keydown', handleKeys);
      window.removeEventListener('resize', closeOnWideScreen);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      if (window.innerWidth < 1024) menuButton.current?.focus({ preventScroll: true });
    };
  }, [menuOpen]);
  const navigation = [['Wallet', '/#wallet'], ['The Vault', '/#how-it-works'], ['Fees', '/#fees'], ['FAQs', '/#faq']];

  return (
    <div className="site-shell" data-menu-open={menuOpen}>
      <div className="site-page" inert={menuOpen}>
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
          <button ref={menuButton} className="grid size-11 place-items-center rounded-lg border border-white/15 bg-white/3 transition hover:bg-purple/10 lg:hidden" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-haspopup="dialog" aria-label="Open menu" onClick={() => setMenuOpen(true)} type="button"><Menu size={22} /></button>
        </div>
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
      </div>
      <div className="mobile-menu-backdrop" aria-hidden="true" onClick={closeMenu} />
      <div ref={drawer} id="mobile-menu" role="dialog" aria-modal={menuOpen ? true : undefined} aria-label="Site menu" aria-hidden={!menuOpen} inert={!menuOpen} className="mobile-menu-drawer">
        <div className="flex items-center justify-between gap-3">
          <Brand onClick={closeMenu} />
          <button ref={closeButton} type="button" aria-label="Close menu" onClick={closeMenu} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-ink transition hover:bg-purple/15"><X size={21} /></button>
        </div>
        <nav aria-label="Mobile navigation" className="mt-12 sm:mt-16">
          <p className="eyebrow mb-5 text-purple">EXPLORE ZETMOND</p>
          {navigation.map(([label, href], index) => <Link key={href} href={href} onClick={closeMenu} className="mobile-menu-link group" style={{ '--item-delay': `${100 + index * 55}ms` }}><span className="text-[10px] font-normal tracking-normal text-muted">0{index + 1}</span><span className="flex-1">{label}</span><ArrowUpRight size={22} className="text-purple transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>)}
        </nav>
        <div className="mt-auto pt-12">
          <div className="grid gap-3"><button className="button button-primary w-full" disabled type="button">Get started <ArrowUpRight size={18} /></button><button className="button button-outline w-full" disabled type="button">Log in</button></div>
          <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-6 text-muted">Your USDT. Your next move.</p>
        </div>
      </div>
    </div>
  );
}
