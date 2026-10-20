'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftRight, ArrowUpRight, CheckCheck, ChevronDown, Clock3, Landmark, Play, ReceiptText, Route, Vault, Wallet } from 'lucide-react';
import Reveal from './Motion';
import HeroWallet from './HeroWallet';

const steps = [
  { label: 'Agree on the trade', state: 'Your agreed terms', title: 'Know the numbers before you commit.', description: 'Choose a fixed-rate offer. Review the USDT amount, fiat amount, and each party’s 0.5% fee. The accepted rate stays with your trade.' },
  { label: 'Fund your side', state: 'Both sides can fund', title: 'Either side can make the first move.', description: 'The buyer pays the Vault’s trade-specific fiat account. The seller funds the exact USDT amount from their Zetmond wallet. A qualifying first payment starts a fresh 15-minute window.' },
  { label: 'Follow settlement', state: 'Two delivery obligations', title: 'Follow both sides, all the way through.', description: 'Once both exact deposits qualify, the Vault coordinates USDT delivery to the buyer and a bank payout to the seller. The trade is complete only when both succeed.' },
];

const questions = [
  ['What is Zetmond?', 'Zetmond is an Africa-focused USDT wallet and fixed-rate P2P product. It brings buyers and sellers onto one clear settlement path with a shared rate, fee structure, and delivery process.'],
  ['How is the Vault different from paying a seller directly?', 'The buyer funds a trade-specific Vault collection account, while the seller funds the USDT side from their Zetmond wallet. Once both exact deposits qualify, the Vault coordinates the buyer’s USDT credit and the seller’s bank payout. No further seller release approval is required.'],
  ['Who holds the wallet keys?', 'Zetmond is a custodial wallet, so you manage your USDT through your account without handling private keys.'],
  ['Do I need to verify my identity?', 'Yes. Approved KYC is required before wallet use or P2P trading. Verification requirements are part of the customer onboarding journey.'],
  ['Can I cancel a trade after paying?', 'Users cannot cancel after either party pays. System cancellation can still happen for conditions such as an incorrect fiat amount or a funding timeout after pending-payment checks.'],
  ['What is returned when a trade is cancelled?', 'No platform fee is retained on a cancelled trade. Any seller USDT deposit, including its platform-fee portion, is returned. The buyer’s received fiat, including its fee portion, is returned less applicable bank refund charges. Pending or failed refunds remain visible until resolved; no completion time is promised.'],
  ['Is my local-currency estimate a fiat balance?', 'No. Your wallet holds USDT. The local-currency figure helps you understand its estimated value; it is not a separate balance you can spend or withdraw.'],
  ['Do both sides have to fund a trade?', 'Yes. Both the buyer’s exact fiat deposit and the seller’s exact USDT deposit must qualify before settlement begins. Either party can fund first, and the Vault tracks both deposits and both payouts.'],
];

function Eyebrow({ children }) {
  return <p className="eyebrow flex items-center gap-2.5 text-purple"><span className="h-px w-6 bg-purple" />{children}</p>;
}

function VaultWalkthrough() {
  const [active, setActive] = useState(0);
  const tabs = useRef([]);
  const step = steps[active];
  function onTabKey(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % steps.length;
    if (event.key === 'ArrowLeft') next = (index + steps.length - 1) % steps.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = steps.length - 1;
    if (next !== undefined) { event.preventDefault(); setActive(next); tabs.current[next]?.focus(); }
  }
  return (
    <div className="mt-12 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
      <div className="grid grid-cols-3 border-b border-ink/10" role="tablist" aria-label="How the Vault works">
        {steps.map((item, index) => <button key={item.label} ref={element => { tabs.current[index] = element; }} id={`vault-tab-${index}`} role="tab" type="button" aria-selected={active === index} aria-controls="vault-panel" tabIndex={active === index ? 0 : -1} onKeyDown={event => onTabKey(event, index)} onClick={() => setActive(index)} className={`vault-tab flex min-h-22 items-center gap-3 border-b-2 px-3 py-5 text-left text-xs font-semibold transition-colors sm:px-7 sm:text-sm ${active === index ? 'border-purple bg-purple/7 text-purple' : 'border-transparent text-muted hover:bg-ink/3'}`}><span className={`grid size-7 shrink-0 place-items-center rounded-full border text-[10px] ${active === index ? 'border-purple/40 bg-purple/10' : 'border-ink/15'}`}>0{index + 1}</span><span>{item.label}</span><ArrowUpRight size={17} className={`ml-auto hidden shrink-0 sm:block ${active === index ? '' : 'opacity-30'}`} /></button>)}
      </div>
      <div id="vault-panel" role="tabpanel" aria-labelledby={`vault-tab-${active}`} tabIndex={0} className="px-5 pt-11 pb-7 sm:px-12">
        <div className={`vault-diagram mx-auto grid max-w-200 grid-cols-[1fr_.65fr_1.2fr_.65fr_1fr] items-center gap-2 py-5 sm:gap-4 ${active > 0 ? 'is-flowing' : ''}`}>
          <div className="flex flex-col items-center text-center"><div className="participant-avatar mb-4 grid size-15 place-items-center rounded-full border border-positive/25 bg-positive/8 text-xl font-semibold text-positive sm:size-19">B</div><strong className="text-sm font-semibold">The buyer</strong><span className="mt-2 text-[11px] text-muted">Supplies local currency</span><span className="mt-1 text-[10px] text-purple">Receives USDT</span></div>
          <div className="flow-line text-center text-[9px] text-muted" aria-hidden="true"><span>Fiat →</span><i /><span>← USDT</span></div>
          <div className="flex flex-col items-center text-center"><div className="vault-emblem mb-4 grid size-21 place-items-center rounded-[22px] border border-purple/45 bg-purple/15 text-purple sm:size-25"><Vault size={44} strokeWidth={1.25} /></div><strong className="text-sm font-semibold">Zetmond Vault</strong><span className="mt-2 rounded-full bg-purple/10 px-2.5 py-1 text-[9px] text-purple">{step.state}</span></div>
          <div className="flow-line text-center text-[9px] text-muted" aria-hidden="true"><span>← USDT</span><i /><span>Fiat →</span></div>
          <div className="flex flex-col items-center text-center"><div className="participant-avatar mb-4 grid size-15 place-items-center rounded-full border border-purple/25 bg-purple/10 text-xl font-semibold text-purple sm:size-19">S</div><strong className="text-sm font-semibold">The seller</strong><span className="mt-2 text-[11px] text-muted">Supplies USDT</span><span className="mt-1 text-[10px] text-purple">Receives a bank payout</span></div>
        </div>
        <div key={active} className="step-description mt-8 flex flex-col gap-4 rounded-xl border border-ink/5 bg-ink/3 p-5 sm:flex-row sm:gap-6 sm:px-7 sm:py-6"><span className="shrink-0 pt-1 text-[10px] font-semibold tracking-wider text-purple">STEP 0{active + 1}</span><div><h3 className="text-base font-semibold">{step.title}</h3><p className="mt-2 max-w-180 text-sm leading-7 text-muted">{step.description}</p></div></div>
      </div>
    </div>
  );
}

export default function MarketingHome() {
  return (
    <main id="main" className="overflow-x-clip">
      <section className="hero-section relative">
        <div className="page-width relative grid items-center gap-10 pt-7 pb-9 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:pt-12 lg:pb-12">
          <div className="hero-copy relative z-20 min-w-0 py-7">
            <h1 className="hero-enter mt-7 font-display text-[clamp(3.5rem,5.5vw,4.8rem)] leading-[1.08] font-semibold tracking-[-.055em]" style={{ animationDelay: '80ms' }}>Your USDT.<br /><span className="hero-accent">Your next move.</span></h1>
            <p className="hero-enter mt-7 max-w-112 text-[15px] leading-7 text-muted" style={{ animationDelay: '160ms' }}>A wallet built around you. A Vault that brings both sides of a trade together. Move forward with clearer terms, transparent fees, and a shared process.</p>
            <div className="hero-enter mt-8 flex flex-wrap items-center gap-5" style={{ animationDelay: '240ms' }}><button type="button" disabled className="button button-primary">Get started <ArrowUpRight size={18} /></button><Link href="#how-it-works" className="group flex min-h-12 items-center gap-2.5 text-xs font-medium"><span className="grid size-8 place-items-center rounded-full border border-ink/20 transition-colors group-hover:border-purple group-hover:text-purple"><Play size={11} fill="currentColor" /></span>See how it works</Link></div>
          </div>
          <HeroWallet />
        </div>
        <ul aria-label="Zetmond benefits" className="page-width relative z-20 grid grid-cols-2 gap-y-7 border-t border-ink/10 py-8 lg:grid-cols-4">
          {[
            [Wallet, 'One USDT wallet', 'Hold, send, and receive in one place.'],
            [Landmark, 'Local bank payouts', 'Sell USDT and receive funds in your bank account.'],
            [ReceiptText, 'Clear pricing', 'Know your rate and platform fee before you pay.'],
            [Route, 'Every step in view', 'Follow your trade from funding to payout.'],
          ].map(([Icon, title, description], index) => (
            <Reveal as="li" key={title} delay={index * 90} className={`min-w-0 px-3 sm:px-6 ${index % 2 === 0 ? 'pl-0 sm:pl-0' : 'border-l border-ink/10'} ${index > 0 ? 'lg:border-l lg:border-ink/10 lg:pl-6' : ''}`}>
              <div className="hero-enter" style={{ animationDelay: `${320 + index * 90}ms` }}>
                <span className="mb-4 grid size-10 place-items-center rounded-xl border border-purple/20 bg-purple/8 text-purple"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>
                <h2 className="font-display text-base font-semibold leading-snug tracking-tight sm:text-lg">{title}</h2>
                <p className="mt-2 max-w-60 text-xs leading-6 text-muted">{description}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <div className="feature-ticker border-y border-ink/8 bg-surface" aria-label="USDT wallet, fixed-rate trades, two-sided funding, and transparent fees"><div className="ticker-track" aria-hidden="true">{[0, 1].map(copy => <div className="ticker-group" key={copy}>{['YOUR USDT, IN FOCUS', 'TWO SIDES. ONE VAULT.', 'CLEAR TERMS, UP FRONT', 'BUILT WITH AFRICA IN MIND'].map(label => <span key={label}><span className="text-purple">✳</span>{label}</span>)}</div>)}</div></div>

      <section className="page-width py-12">
        <div className="grid gap-4 md:grid-cols-3">
          <Reveal><Link href="#how-it-works" className="feature-card group relative flex min-h-48 overflow-hidden rounded-xl border border-ink/10 bg-card-purple p-6"><div className="relative z-10 max-w-[65%]"><span className="text-[9px] font-semibold tracking-[.12em] text-purple">MEET THE VAULT</span><h2 className="mt-4 font-display text-xl leading-tight font-semibold">Better together.<br />Both sides funded.</h2><ArrowUpRight className="mt-5 text-purple transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={20} /></div><Image src="/images/hero-vault.png" alt="" width={1254} height={1254} sizes="200px" className="vault-feature-art absolute -right-10 -bottom-4 h-52 w-52 object-contain opacity-80 mix-blend-lighten transition-transform duration-500 group-hover:scale-110" /></Link></Reveal>
          <Reveal delay={100}><Link href="#wallet" className="feature-card group relative flex min-h-48 overflow-hidden rounded-xl border border-ink/10 bg-card-green p-6"><div className="relative z-10 max-w-[65%]"><span className="text-[9px] font-semibold tracking-[.12em] text-positive">YOUR EVERYDAY USDT</span><h2 className="mt-4 font-display text-xl leading-tight font-semibold">One wallet.<br />More clarity.</h2><ArrowUpRight className="mt-5 text-positive transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={20} /></div><div className="mini-coin coin-back" aria-hidden="true">₮</div><div className="mini-coin coin-front" aria-hidden="true">₮</div></Link></Reveal>
          <Reveal delay={200}><Link href="/vault-policy#fees" className="feature-card group relative flex min-h-48 overflow-hidden rounded-xl border border-ink/10 bg-card-amber p-6"><div className="relative z-10 max-w-[70%]"><span className="text-[9px] font-semibold tracking-[.12em] text-warm">EVERY NUMBER MATTERS</span><h2 className="mt-4 font-display text-xl leading-tight font-semibold">Know the fee.<br />Before you pay.</h2><ArrowUpRight className="mt-5 text-warm transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={20} /></div><span className="fee-sculpture" aria-hidden="true">%</span></Link></Reveal>
        </div>
      </section>



      <section id="how-it-works" className="border-y border-ink/7 bg-section">
        <div className="page-width section-space"><Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><Eyebrow>THE TWO-SIDED VAULT</Eyebrow><h2 className="section-title mt-5">A shared process.<br /><span className="text-purple">A clearer exchange.</span></h2></div><p className="max-w-86 text-sm leading-7 text-muted">The buyer funds the fiat side. The seller funds the USDT side. The Vault brings both deposits and both deliveries into view.</p></Reveal><Reveal delay={120}><VaultWalkthrough /></Reveal><Reveal delay={180} className="mt-6 flex flex-col gap-4 rounded-xl border border-purple/15 bg-purple/5 p-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6"><Clock3 size={23} className="shrink-0 text-purple" strokeWidth={1.5} /><p className="flex-1 text-xs leading-6 text-muted"><strong className="mb-1 block font-semibold text-ink">20 minutes to get started. A fresh 15 after the first payment.</strong>Either party can fund first. A qualifying first payment replaces the original deadline with a new 15-minute window for the other party.</p><Link href="/vault-policy#timers" className="inline-link shrink-0 self-start !text-[11px] sm:mt-1">The timing rules <ArrowUpRight size={14} /></Link></Reveal></div>
      </section>



      <section className="page-width pt-14 lg:pt-20"><Reveal className="community-panel relative grid overflow-hidden rounded-2xl border border-ink/10 bg-surface lg:grid-cols-2"><div className="relative z-10 px-7 py-11 sm:p-12"><Eyebrow>BUILT WITH AFRICA IN MIND</Eyebrow><h2 className="section-title mt-6 !text-[clamp(2.4rem,4vw,3.5rem)]">Real people.<br />Everyday ambition.<br /><span className="text-purple">A clearer next step.</span></h2><p className="mt-6 max-w-94 text-sm leading-7 text-muted">For the plans you’re making and the opportunities ahead. Zetmond brings your USDT balance, trade terms, and next steps into focus.</p><Link className="inline-link mt-7" href="#faq">Get to know Zetmond <ArrowUpRight size={16} /></Link></div><div className="relative min-h-80 lg:min-h-full"><Image src="/images/community.png" alt="Illustrative editorial image of two African professionals working together with a laptop and phone" fill sizes="(max-width: 1023px) 100vw, 50vw" className="object-cover object-center" /><div className="community-image-shade absolute inset-0" /><span className="absolute right-4 bottom-4 rounded-full bg-black/60 px-3 py-1.5 text-[9px] text-white/75">Illustrative imagery</span></div></Reveal></section>

      <section className="page-width section-space"><Reveal><Eyebrow>CLARITY WHEN IT COUNTS</Eyebrow><h2 className="section-title mt-5">Know what happens next.</h2></Reveal><div className="mt-9 grid gap-5 md:grid-cols-3">{[[ArrowLeftRight, 'Wrong fiat amount?', 'Underpayments and overpayments cancel the trade. Received funds are returned, with applicable bank refund charges deducted from the buyer’s refund.'], [Clock3, 'Payment still pending?', 'Uncertain payments at the deadline go into review. You can follow the checks before the trade progresses.'], [CheckCheck, 'One payout needs attention?', 'USDT delivery and bank payout are tracked separately. A trade is complete only when both obligations are fulfilled.']].map(([Icon, title, description], index) => <Reveal key={title} delay={index * 100} className="exception-card rounded-xl border border-ink/10 bg-ink/2 p-7"><Icon size={25} className="mb-6 text-purple" strokeWidth={1.4} /><h3 className="text-base font-semibold">{title}</h3><p className="mt-3 text-xs leading-7 text-muted">{description}</p></Reveal>)}</div></section>

      <section id="faq" className="page-width grid gap-10 border-t border-ink/10 pt-17 pb-22 lg:grid-cols-[.8fr_1.2fr] lg:gap-20"><Reveal><Eyebrow>GOOD QUESTIONS</Eyebrow><h2 className="section-title mt-5">Your questions,<br /><span className="text-purple">answered.</span></h2><p className="mt-6 max-w-80 text-sm leading-7 text-muted">Get familiar with the wallet, the Vault, and the details behind your next trade.</p><Link href="/vault-policy" className="inline-link mt-6">Explore the Vault policy <ArrowUpRight size={16} /></Link></Reveal><Reveal delay={120} className="border-t border-ink/15">{questions.map(([question, answer], index) => <details className="faq-item group border-b border-ink/10" key={question}><summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 py-5 text-[13px] font-medium"><span className="text-[10px] font-normal text-muted">0{index + 1}</span><span className="flex-1">{question}</span><ChevronDown size={17} className="shrink-0 text-purple transition-transform group-open:rotate-180" /></summary><p className="pr-6 pb-6 pl-8 text-xs leading-7 text-muted">{answer}</p></details>)}</Reveal></section>

      <section className="page-width pb-4"><Reveal className="final-cta-v2 relative isolate overflow-hidden rounded-2xl border border-purple/20 px-7 py-13 text-center sm:py-17"><div className="cta-orbit" aria-hidden="true" /><p className="eyebrow text-purple">YOUR NEXT CHAPTER STARTS WITH CLARITY</p><h2 className="relative mt-5 font-display text-[clamp(2.5rem,5vw,4.6rem)] leading-[1.08] font-semibold tracking-[-.05em]">Make your next move.<br /><span className="text-purple">Make it with Zetmond.</span></h2><p className="relative mt-5 text-sm text-muted">Hold your USDT. Find your trade. Follow every step with Zetmond.</p><button className="button button-primary relative mt-8" type="button" disabled>Get started <ArrowUpRight size={18} /></button></Reveal></section>
    </main>
  );
}
