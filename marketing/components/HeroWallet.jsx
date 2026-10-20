'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, ChevronRight, Clock3, Eye, EyeOff, History, LayoutDashboard, LockKeyhole, Wallet } from 'lucide-react';

export default function HeroWallet() {
  const [balancesVisible, setBalancesVisible] = useState(true);
  const [activityView, setActivityView] = useState('activity');
  const VisibilityIcon = balancesVisible ? Eye : EyeOff;

  return (
    <figure id="wallet" aria-label="Zetmond wallet interface illustration" className="hero-wallet relative isolate mx-auto w-full max-w-144 min-w-0">
      <div className="hero-wallet-glow" aria-hidden="true" />
      <div className="hero-wallet-surface hero-enter relative overflow-hidden rounded-2xl border border-ink/15 bg-surface" style={{ animationDelay: '180ms' }}>
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/8 bg-ink/2 px-4 sm:px-5">
          <div className="flex items-center gap-3"><span className="flex gap-1.5" aria-hidden="true"><i className="size-1.5 rounded-full bg-ink/25" /><i className="size-1.5 rounded-full bg-ink/15" /><i className="size-1.5 rounded-full bg-ink/10" /></span><span className="text-[9px] font-medium tracking-[.14em] text-muted">ZETMOND / WALLET</span></div>
          <LockKeyhole size={12} className="text-muted" aria-hidden="true" />
        </div>
        <div className="flex">
          <div className="hidden w-15 shrink-0 flex-col items-center gap-5 border-r border-ink/8 bg-ink/3 py-5 sm:flex" aria-hidden="true">
            <span className="grid size-8 place-items-center rounded-lg bg-purple text-base font-bold italic text-on-accent">Z</span>
            {[LayoutDashboard, Wallet, ArrowLeftRight, History].map((Icon, index) => <span key={index} className={`grid size-9 place-items-center rounded-lg ${index === 0 ? 'bg-purple/12 text-purple' : 'text-muted/60'}`}><Icon size={17} strokeWidth={1.6} /></span>)}
          </div>
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-base font-semibold tracking-tight">Your wallet</h2><span className="flex items-center gap-1.5 rounded-full border border-positive/15 bg-positive/5 px-2 py-1 text-[9px] font-medium text-positive"><span className="size-1 rounded-full bg-positive" />USDT</span></div>
            <div className="hero-wallet-balance rounded-xl border border-purple/20 p-4 sm:p-5">
              <div className="flex items-center justify-between"><p className="text-[10px] font-medium text-muted">Total balance</p><button type="button" aria-label={balancesVisible ? 'Hide wallet balances' : 'Show wallet balances'} aria-pressed={!balancesVisible} onClick={() => setBalancesVisible(!balancesVisible)} className="-m-2 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink/8 hover:text-ink"><VisibilityIcon size={15} /></button></div>
              <div aria-live="polite" aria-atomic="true"><p className="mt-3 flex items-baseline gap-2 font-display text-[40px] leading-none font-semibold tracking-[-.055em] sm:text-[46px]">{balancesVisible ? <>250<span className="-ml-2 text-muted">.00</span></> : '••••'}<span className="text-xs font-medium tracking-normal text-muted">USDT</span></p><p className="mt-3 text-[10px] text-muted">{balancesVisible ? '≈ ₦325,000.00' : '≈ ••••'} <span className="ml-1 text-[9px]">local estimate</span></p></div>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-ink/10" aria-hidden="true"><div className="h-full w-[88%] rounded-full bg-purple" /></div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[10px]"><div><dt className="flex items-center gap-1.5 text-muted"><span className="size-1 rounded-full bg-purple" />Available</dt><dd className="mt-1 font-semibold text-ink">{balancesVisible ? '220.00 USDT' : '•••• USDT'}</dd></div><div><dt className="flex items-center gap-1.5 text-muted"><span className="size-1 rounded-full bg-ink/25" />In trades</dt><dd className="mt-1 font-semibold text-ink">{balancesVisible ? '30.00 USDT' : '•••• USDT'}</dd></div></dl>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">{[[ArrowUpRight, 'Send'], [ArrowDownLeft, 'Receive'], [ArrowLeftRight, 'Trade']].map(([Icon, label], index) => <button type="button" disabled key={label} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-[10px] font-semibold ${index === 0 ? 'bg-purple text-on-accent' : 'border border-ink/10 bg-ink/3 text-ink'}`}><Icon size={13} aria-hidden="true" />{label}</button>)}</div>
            <div role="group" aria-label="Wallet activity view" className="mt-5 flex items-center gap-5 border-b border-ink/8">
              {[['activity', 'Activity'], ['trades', 'Trades']].map(([value, label]) => <button key={value} id={`wallet-view-${value}`} type="button" aria-pressed={activityView === value} aria-controls="wallet-activity" onClick={() => setActivityView(value)} className={`border-b-2 pb-2.5 text-[11px] font-medium transition-colors ${activityView === value ? 'border-purple text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{label}</button>)}
            </div>
            <div id="wallet-activity" role="region" aria-labelledby={`wallet-view-${activityView}`} aria-live="polite" className="min-h-29">
              {activityView === 'activity' ? <div key="activity" className="step-description">
                <div className="flex items-center gap-2.5 border-b border-ink/5 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-positive/8 text-positive"><ArrowDownLeft size={15} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-medium">USDT received</p><p className="mt-1 text-[9px] text-muted">Wallet transfer</p></div><div className="text-right"><p className="text-[11px] font-semibold">+50.00 USDT</p><p className="mt-1 text-[9px] text-positive">Completed</p></div></div>
                <div className="flex items-center gap-2.5 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-purple/8 text-purple"><ArrowUpRight size={15} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-medium">USDT sent</p><p className="mt-1 text-[9px] text-muted">Wallet transfer</p></div><div className="text-right"><p className="text-[11px] font-semibold">−20.00 USDT</p><p className="mt-1 text-[9px] text-muted">Completed</p></div></div>
              </div> : <div key="trades" className="step-description py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-purple/8 text-purple"><ArrowLeftRight size={15} /></span><div className="flex-1"><p className="text-[11px] font-medium">Sell USDT</p><p className="mt-1 text-[9px] text-muted">Two-sided Vault</p></div><span className="flex items-center gap-1 text-[9px] text-purple"><Clock3 size={11} />Funding</span></div><div className="mt-3 flex items-center gap-2 rounded-md bg-ink/3 px-3 py-2 text-[9px] text-muted"><Check size={11} className="text-positive" />Terms agreed<ChevronRight size={10} /><span className="text-purple">Funding in progress</span></div></div>}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[10px] tracking-wide text-muted">Your balance, transfers, and trades. One clear view.</figcaption>
    </figure>
  );
}
