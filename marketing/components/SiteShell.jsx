'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, Check, Menu, Sparkles, X } from 'lucide-react';

const PreviewContext = createContext(() => {});
export const usePreview = () => useContext(PreviewContext);

export function Brand({ footer = false }) {
  return (
    <Link href="/" aria-label="Zetmond home" className={`brand inline-flex shrink-0 ${footer ? 'w-36' : 'w-36 sm:w-40'}`}>
      <img src="/zetmond-logo.png" alt="Zetmond" width="2200" height="800" className="h-auto w-full" />
    </Link>
  );
}

function PreviewDialog({ open, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
    dialog.current?.close();
  }, [open]);

  return (
    <dialog ref={dialog} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="preview-dialog" aria-labelledby="preview-title" aria-describedby="preview-description">
      <div className="relative p-7 sm:p-10">
        <button type="button" onClick={onClose} aria-label="Close preview notice" autoFocus className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-lavender text-ink hover:bg-purple/15"><X size={19} /></button>
        <div className="mb-7 grid size-14 place-items-center rounded-2xl bg-purple/10 text-purple"><Sparkles size={27} /></div>
        <p className="eyebrow text-purple">A FIRST LOOK AT ZETMOND</p>
        <h2 id="preview-title" className="mt-4 font-display text-4xl leading-tight tracking-tight">Good things<br />are taking shape.</h2>
        <p id="preview-description" className="mt-5 leading-relaxed text-muted">You’re exploring our marketing preview. Registration, login, and the customer wallet will be connected when the web app is ready.</p>
        <div className="my-6 flex items-start gap-3 rounded-xl bg-lavender p-4 text-sm leading-relaxed"><Check size={18} className="mt-0.5 shrink-0 text-purple" /><p>No real funds, bank details, or identity documents are collected here.</p></div>
        <Link href="/#how-it-works" onClick={onClose} className="button button-primary w-full">See how the Vault works <ArrowUpRight size={18} /></Link>
      </div>
    </dialog>
  );
}

export default function SiteShell({ children }) {
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const openPreview = () => { setMenuOpen(false); setPreviewOpen(true); };
  const navigation = [['The Vault', '/#how-it-works'], ['Your wallet', '/#wallet'], ['Fees', '/#fees'], ['FAQs', '/#faq']];

  return (
    <PreviewContext.Provider value={openPreview}>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-ink/7 bg-paper/95 backdrop-blur-lg">
        <div className="page-width flex h-22 items-center justify-between gap-5">
          <div className="flex items-center gap-4"><Brand /><span className="hidden rounded-full border border-purple/15 px-2.5 py-1 text-[9px] font-semibold tracking-[.15em] text-purple sm:inline-flex">PREVIEW</span></div>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
            {navigation.map(([label, href]) => <Link className="nav-link" key={href} href={href}>{label}</Link>)}
          </nav>
          <div className="hidden items-center gap-6 lg:flex">
            <button className="nav-link" type="button" onClick={openPreview}>Log in</button>
            <button className="button button-dark !min-h-11 !px-5 !text-[13px]" type="button" onClick={openPreview}>Explore Zetmond <ArrowUpRight size={16} /></button>
          </div>
          <button ref={menuButton} className="grid size-11 place-items-center rounded-lg border border-ink/10 lg:hidden" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)} type="button">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!menuOpen} className="border-t border-ink/8 bg-paper px-6 pb-6 lg:hidden">
          <div className="flex flex-col">{navigation.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="border-b border-ink/7 py-4 text-sm font-medium">{label}</Link>)}</div>
          <div className="mt-5 flex gap-3"><button className="button button-outline flex-1" onClick={openPreview} type="button">Log in</button><button className="button button-primary flex-1" onClick={openPreview} type="button">Explore <ArrowUpRight size={16} /></button></div>
        </nav>
      </header>
      {children}
      <footer className="page-width pt-18 pb-7">
        <div className="grid gap-10 border-b border-ink/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr_1fr]">
          <div><Brand footer /><p className="mt-4 max-w-64 text-sm leading-7 text-muted">Your USDT.<br />A clearer way to trade.</p><div className="mt-5 inline-flex items-center gap-2 text-xs text-muted"><span className="size-1.5 rounded-full bg-purple" />Built with Africa in mind.</div></div>
          <div><h2 className="footer-heading">EXPLORE</h2><div className="footer-links"><Link href="/#how-it-works">How the Vault works</Link><Link href="/#wallet">Your wallet</Link><Link href="/#fees">Fees explained</Link></div></div>
          <div><h2 className="footer-heading">THE DETAILS</h2><div className="footer-links"><Link href="/vault-policy">Vault & fee rules</Link><Link href="/terms">Terms <span className="text-[10px] text-purple">DRAFT</span></Link><Link href="/privacy">Privacy <span className="text-[10px] text-purple">DRAFT</span></Link></div></div>
          <div><h2 className="footer-heading">HERE TO HELP</h2><div className="footer-links"><Link href="/#faq">Common questions <ArrowUpRight size={13} /></Link><button type="button" onClick={openPreview}>Account access <ArrowUpRight size={13} /></button></div><p className="mt-4 max-w-52 text-xs leading-6 text-muted">Support channels will be published when confirmed.</p></div>
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-[11px] leading-5 text-muted sm:flex-row"><p>© 2026 Zetmond. Product prototype.</p><p className="flex items-center gap-2"><ArrowDownRight size={13} /> Simulated funds. No live trading or deposits.</p></div>
      </footer>
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </PreviewContext.Provider>
  );
}
