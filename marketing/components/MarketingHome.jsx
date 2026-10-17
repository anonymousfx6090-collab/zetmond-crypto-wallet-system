'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleDollarSign, Clock3, Eye, Globe2, Info, Layers3, LockKeyhole, ShieldCheck, Sparkles, Vault, Wallet } from 'lucide-react';
import { usePreview } from './SiteShell';

const steps = [
  { label: 'Agree on the trade', state: 'Your agreed terms', title: 'Know the numbers before you commit.', description: 'Choose a fixed-rate offer. Review the USDT amount, fiat amount, and each party’s 0.5% fee. The accepted rate stays with your trade.' },
  { label: 'Fund your side', state: 'Both sides can fund', title: 'Either side can make the first move.', description: 'The buyer pays the Vault’s trade-specific fiat account. The seller funds the exact USDT amount from their Zetmond wallet. A verified first payment starts a fresh 15-minute window.' },
  { label: 'Follow settlement', state: 'Two delivery obligations', title: 'Follow both sides, all the way through.', description: 'Once both exact deposits qualify, the Vault coordinates USDT delivery to the buyer and a bank payout to the seller. The trade is complete only when both succeed.' },
];

const questions = [
  ['What is Zetmond?', 'Zetmond is an Africa-focused USDT wallet and fixed-rate P2P product in development. This website introduces a prototype: balances, identity checks, and payment integrations are simulated.'],
  ['How is the Vault different from paying a seller directly?', 'The buyer funds a trade-specific Vault collection account, while the seller funds the USDT side from their Zetmond wallet. Once both exact deposits qualify, the Vault coordinates the buyer’s USDT credit and the seller’s bank payout. No further seller release approval is required.'],
  ['Who holds the wallet keys?', 'The intended product is custodial: Zetmond controls wallet keys through its eventual custody arrangement. The prototype uses simulated balances and no real wallet keys. Custody providers and supported USDT networks remain undecided.'],
  ['Do I need to verify my identity?', 'Yes. Approved KYC is required before wallet use or P2P trading. The prototype will simulate verification. Live identity requirements, documents, and provider selection are still being defined.'],
  ['Can I cancel a trade after paying?', 'Users cannot cancel after either party pays. System cancellation can still happen for conditions such as an incorrect fiat amount or a funding timeout after pending-payment checks. Whether users can cancel before either party funds remains TBD.'],
  ['What is returned when a trade is cancelled?', 'No platform fee is retained on a cancelled trade. Any seller USDT deposit, including its platform-fee portion, is returned. The buyer’s received fiat, including its fee portion, is returned less applicable bank refund charges. Pending or failed refunds remain visible until resolved; no completion time is promised.'],
  ['Which countries and networks are supported?', 'Launch settlement countries, payment partners, and USDT networks are still being finalised. A local-currency example does not establish an available P2P market. All naira figures on this page are illustrative.'],
  ['Can I use real money here?', 'No. This is a marketing preview for a simulated product. It does not accept deposits, identity documents, or live trades. Account access will be connected when the customer web app is available.'],
];

function Eyebrow({ children, light = false }) {
  return <p className={`eyebrow ${light ? 'text-lilac' : 'text-purple'}`}>{children}</p>;
}

function WalletPreview() {
  return (
    <div className="hero-art relative isolate flex min-h-130 items-center justify-center lg:min-h-150" aria-label="Illustrative wallet: 250 USDT total, 220 available and 30 held in trades">
      <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      <span className="art-star absolute top-9 right-6 text-6xl text-purple" aria-hidden="true">✳</span>
      <span className="absolute bottom-20 left-3 text-5xl text-purple/35" aria-hidden="true">✧</span>
      <div className="floating-label absolute top-7 left-10 z-10 flex items-center gap-2.5 rounded-full border border-purple/10 bg-white px-4 py-2.5 text-[11px] font-medium shadow-sm sm:left-14"><span className="size-1.5 rounded-full bg-purple" />Clarity at every step</div>
      <div className="wallet-preview relative z-10 w-[85%] max-w-100 overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_30px_70px_-25px_#43236f40]">
        <div className="flex items-center justify-between border-b border-ink/6 px-6 py-5"><span className="flex items-center gap-2 text-sm font-bold"><span className="grid size-6 place-items-center rounded-md bg-purple text-xs font-black italic text-white">Z</span>Zetmond</span><span className="text-[8px] font-semibold tracking-[.16em] text-muted">DEMO WALLET</span></div>
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2 text-xs text-muted">Your total balance <Eye size={12} /></div>
          <p className="mt-3 whitespace-nowrap text-[46px] leading-none font-semibold tracking-[-.055em] text-ink">250<span className="text-ink/35">.00</span> <span className="text-sm font-medium tracking-normal">USDT</span></p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">≈ ₦325,000.00 <span className="rounded bg-lavender px-1.5 py-0.5 text-[9px]">Local estimate</span></div>
          <div className="mt-6 grid grid-cols-2 border-t border-ink/7 pt-4 text-[10px] text-muted"><div><span className="mr-1 inline-block size-1.5 rounded-full bg-purple" /> Available<strong className="mt-1 block text-sm font-semibold text-ink">220 USDT</strong></div><div className="border-l border-ink/7 pl-5"><span className="mr-1 inline-block size-1.5 rounded-full bg-[#bfaaed]" /> In trades<strong className="mt-1 block text-sm font-semibold text-ink">30 USDT</strong></div></div>
          <div className="my-5 grid grid-cols-3 gap-2" aria-hidden="true">
            {[[ArrowUpRight, 'Send'], [ArrowDownLeft, 'Receive'], [ArrowLeftRight, 'Trade']].map(([Icon, label], index) => <div key={label} className={`flex items-center justify-center gap-2 rounded-lg py-3 text-[10px] font-medium ${index === 0 ? 'bg-purple text-white' : 'bg-lavender text-ink'}`}><Icon size={14} />{label}</div>)}
          </div>
        </div>
        <div className="mx-6 flex items-center justify-between border-t border-ink/7 py-4"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-[#eef2e6] text-[#4c682f]"><ArrowDownLeft size={15} /></span><span className="text-[10px] font-medium">USDT received<span className="mt-0.5 block text-[9px] text-muted">Illustrative transaction</span></span></div><span className="text-[10px] font-semibold">+50 USDT<span className="mt-0.5 block text-right text-[9px] font-normal text-[#4c682f]">Completed</span></span></div>
        <p className="bg-paper px-6 py-2.5 text-[9px] text-muted">Illustrative rate · Nigeria display example</p>
      </div>
      <div className="trade-notice absolute right-0 bottom-13 z-20 flex items-center gap-3 rounded-2xl border border-white bg-white px-5 py-4 shadow-[0_10px_40px_-10px_#43236f30] sm:right-1 lg:-right-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-[#465527]"><CheckCheck size={19} /></div><div className="text-xs font-semibold">Both sides. One Vault.<span className="mt-1 block text-[10px] font-normal text-muted">Two deposits, coordinated settlement.</span></div><ArrowUpRight className="ml-2 text-purple" size={18} /></div>
      <p className="absolute -bottom-1 left-10 flex items-center gap-2 text-[11px] italic text-muted sm:left-15"><ArrowDownRight size={19} className="text-purple" /> A little less guesswork. A lot more clarity.</p>
    </div>
  );
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
    <div className="mt-12 overflow-hidden rounded-2xl border border-ink/10 bg-white">
      <div className="grid grid-cols-3 border-b border-ink/10" role="tablist" aria-label="How the Vault works">
        {steps.map((item, index) => <button key={item.label} ref={element => { tabs.current[index] = element; }} id={`vault-tab-${index}`} role="tab" type="button" aria-selected={active === index} aria-controls="vault-panel" tabIndex={active === index ? 0 : -1} onKeyDown={event => onTabKey(event, index)} onClick={() => setActive(index)} className={`vault-tab flex min-h-22 items-center gap-3 border-b-2 px-3 py-5 text-left text-xs font-semibold transition-colors sm:px-7 sm:text-sm ${active === index ? 'border-purple bg-lavender/60 text-purple' : 'border-transparent text-muted hover:bg-paper'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] ${active === index ? 'border-purple/20 bg-white' : 'border-ink/10'}`}>0{index + 1}</span><span>{item.label}</span><ArrowUpRight size={17} className={`ml-auto hidden shrink-0 sm:block ${active === index ? '' : 'opacity-30'}`} /></button>)}
      </div>
      <div id="vault-panel" role="tabpanel" aria-labelledby={`vault-tab-${active}`} tabIndex={0} className="px-5 pt-12 pb-7 sm:px-12">
        <div className="vault-diagram mx-auto grid max-w-200 grid-cols-[1fr_.65fr_1.2fr_.65fr_1fr] items-center gap-2 py-3 sm:gap-4">
          <div className="flex flex-col items-center text-center"><div className="mb-4 grid size-14 place-items-center rounded-full bg-[#f0e8de] text-xl font-medium text-[#836646] sm:size-17">B</div><strong className="text-sm font-semibold">The buyer</strong><span className="mt-2 text-[11px] text-muted">Supplies local currency</span><span className="mt-1 text-[10px] text-purple">Receives USDT</span></div>
          <div className={`flow-line text-center text-[9px] text-muted ${active > 0 ? 'flow-active' : ''}`} aria-hidden="true"><span>Fiat →</span><i /><span>← USDT</span></div>
          <div className="flex flex-col items-center text-center"><div className={`vault-emblem mb-4 grid size-21 place-items-center rounded-[22px] text-white shadow-[0_8px_25px_#7346ea35] sm:size-25 ${active === 2 ? 'bg-[#594283]' : 'bg-purple'}`}><Vault size={44} strokeWidth={1.25} /></div><strong className="text-sm font-semibold">Zetmond Vault</strong><span className="mt-2 rounded-full bg-lavender px-2.5 py-1 text-[9px] text-purple">{step.state}</span></div>
          <div className={`flow-line text-center text-[9px] text-muted ${active > 0 ? 'flow-active' : ''}`} aria-hidden="true"><span>← USDT</span><i /><span>Fiat →</span></div>
          <div className="flex flex-col items-center text-center"><div className="mb-4 grid size-14 place-items-center rounded-full bg-[#e6e2f1] text-xl font-medium text-purple sm:size-17">S</div><strong className="text-sm font-semibold">The seller</strong><span className="mt-2 text-[11px] text-muted">Supplies USDT</span><span className="mt-1 text-[10px] text-purple">Receives a bank payout</span></div>
        </div>
        <div className="mt-10 flex flex-col gap-4 rounded-xl bg-paper p-5 sm:flex-row sm:gap-6 sm:px-7 sm:py-6"><span className="shrink-0 pt-1 text-[10px] font-semibold tracking-wider text-purple">STEP 0{active + 1}</span><div><h3 className="text-base font-semibold">{step.title}</h3><p className="mt-2 max-w-180 text-sm leading-7 text-muted">{step.description}</p></div></div>
      </div>
    </div>
  );
}

// All example amounts use integers: USDT millionths and fiat hundredths.
// The slider's multiples of 10 produce exact fees without a rounding policy.
function formatUnits(value, scale) {
  const unit = 10n ** BigInt(scale);
  const whole = new Intl.NumberFormat('en-NG').format(value / unit);
  const fraction = (value % unit).toString().padStart(scale, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function FeeCalculator() {
  const [quantity, setQuantity] = useState(10);
  const q = BigInt(quantity);
  const cryptoPrincipal = q * 1_000_000n;
  const cryptoFee = cryptoPrincipal / 200n;
  const fiatPrincipal = q * 130_000n;
  const fiatFee = fiatPrincipal / 200n;
  const usdt = value => `${formatUnits(value, 6)} USDT`;
  const fiat = value => `₦${formatUnits(value, 2)}`;
  const invoices = [
    { role: 'THE SELLER', principal: usdt(cryptoPrincipal), fee: usdt(cryptoFee), total: usdt(cryptoPrincipal + cryptoFee), receives: fiat(fiatPrincipal), principalLabel: 'USDT principal', receiveLabel: 'Fiat principal to receive', color: 'bg-purple' },
    { role: 'THE BUYER', principal: fiat(fiatPrincipal), fee: fiat(fiatFee), total: fiat(fiatPrincipal + fiatFee), receives: usdt(cryptoPrincipal), principalLabel: 'Fiat principal', receiveLabel: 'USDT to receive', color: 'bg-[#819449]' },
  ];
  return (
    <div className="min-w-0 rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_10px_40px_-30px_#28143c30] sm:p-8">
      <div className="flex items-center justify-between gap-4"><span className="eyebrow text-ink">TRY AN EXAMPLE</span><span className="rounded-full bg-lavender px-2.5 py-1 text-[9px] font-semibold tracking-wider text-purple">SIMULATED</span></div>
      <div className="mt-8 flex items-center justify-between gap-3"><label htmlFor="trade-quantity" className="text-xs text-muted">Trade amount</label><output htmlFor="trade-quantity" className="text-2xl font-semibold tracking-tight">{quantity.toLocaleString('en-NG')} <span className="text-sm font-normal text-muted">USDT</span></output></div>
      <input id="trade-quantity" aria-describedby="calculator-explanation" type="range" min="10" max="1000" step="10" value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="fee-range mt-5 w-full" style={{ '--range-fill': `${((quantity - 10) / 990) * 100}%` }} />
      <div className="mt-1 flex justify-between text-[10px] text-muted"><span>10 USDT</span><span>1,000 USDT</span></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">
        {invoices.map(invoice => <div key={invoice.role} className="min-w-0 rounded-xl border border-ink/8 bg-paper p-4"><div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider"><span className={`size-1.5 rounded-full ${invoice.color}`} />{invoice.role}</div><dl className="mt-6 space-y-3 text-[11px]"><div className="flex justify-between gap-2"><dt className="text-muted">{invoice.principalLabel}</dt><dd className="text-right font-medium">{invoice.principal}</dd></div><div className="flex justify-between gap-2"><dt className="text-muted">Fee <span className="text-[9px]">(0.5%)</span></dt><dd className="text-right font-medium">{invoice.fee}</dd></div><div className="flex flex-wrap justify-between gap-2 border-t border-ink/10 pt-4 text-xs"><dt className="font-medium">Deposits</dt><dd className="font-semibold text-purple" data-testid={invoice.role === 'THE SELLER' ? 'seller-deposit' : 'buyer-deposit'}>{invoice.total}</dd></div></dl><div className="mt-5 border-t border-ink/10 pt-4"><span className="text-[10px] text-muted">{invoice.receiveLabel}</span><strong className="mt-1 block text-lg font-semibold tracking-tight">{invoice.receives}</strong></div></div>)}
      </div>
      <p id="calculator-explanation" className="mt-5 text-[10px] leading-5 text-muted">Move the slider to explore the fee. This example does not establish supported markets, trade limits, or a live rounding policy.</p>
    </div>
  );
}

export default function MarketingHome() {
  const openPreview = usePreview();
  return (
    <main id="main">
      <section className="page-width grid items-center gap-5 pt-13 pb-15 lg:grid-cols-[1.04fr_1fr] lg:gap-12 lg:pt-16 lg:pb-22">
        <div className="hero-copy relative z-20">
          <p className="eyebrow flex items-center gap-2.5 text-purple"><span className="size-1.5 rounded-full bg-purple" />A NEW WAY TO MEET IN THE MIDDLE</p>
          <h1 className="mt-7 font-display text-[clamp(3.75rem,6.8vw,6.15rem)] leading-[1.02] tracking-[-.055em]">Your USDT.<br />A <em className="font-normal text-purple">clearer</em> way<br />to trade.</h1>
          <p className="mt-7 max-w-102 text-[15px] leading-7 text-muted">A wallet for your USDT. A shared Vault for your trades. Know what you’re sending, what you’ll receive, and what happens next.</p>
          <div className="mt-8 flex flex-wrap items-center gap-5"><Link href="#how-it-works" className="button button-primary">Explore the Vault <ArrowUpRight size={18} /></Link><button className="group flex min-h-12 items-center gap-2 text-[13px] font-medium" type="button" onClick={openPreview}>Meet your wallet <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></button></div>
          <p className="mt-7 flex items-center gap-2 text-[10px] text-muted"><ShieldCheck size={13} />A working idea. Simulated funds. No real money.</p>
        </div>
        <WalletPreview />
      </section>

      <div className="border-y border-ink/8 bg-[#f0ecf6]">
        <div className="page-width grid grid-cols-2 gap-x-4 gap-y-6 py-7 lg:grid-cols-4">
          {[[CircleDollarSign, 'USDT at the centre'], [ArrowLeftRight, 'Both sides fund the Vault'], [Layers3, '0.5% per party'], [Globe2, 'Built with Africa in mind']].map(([Icon, text]) => <p key={text} className="flex items-center gap-3 text-[11px] font-medium text-ink/75 sm:justify-center sm:text-xs"><Icon size={19} className="shrink-0 text-purple" strokeWidth={1.4} />{text}</p>)}
        </div>
      </div>

      <section id="how-it-works" className="page-width section-space">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><Eyebrow>01 / THE VAULT</Eyebrow><h2 className="section-title mt-5">Two deposits.<br />One agreed trade.</h2></div><p className="max-w-86 text-sm leading-7 text-muted">A good trade starts with clear terms. Zetmond brings the buyer’s fiat and seller’s USDT into one coordinated process.</p></div>
        <VaultWalkthrough />
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-purple/10 bg-lavender/60 p-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6"><Clock3 size={23} className="shrink-0 text-purple" strokeWidth={1.5} /><p className="flex-1 text-xs leading-6 text-muted"><strong className="mb-1 block font-semibold text-ink">20 minutes to get started. A fresh 15 after the first payment.</strong>Either party can fund first. A qualifying first payment replaces the original deadline with a new 15-minute window for the other party.</p><Link href="/vault-policy#timers" className="inline-link shrink-0 self-start !text-[11px] sm:mt-1">The timing rules <ArrowUpRight size={14} /></Link></div>
      </section>

      <section id="wallet" className="relative overflow-hidden bg-ink text-white">
        <div className="page-width grid items-center gap-14 py-18 lg:grid-cols-2 lg:gap-24 lg:py-23">
          <div><Eyebrow light>02 / YOUR WALLET</Eyebrow><h2 className="section-title mt-5">USDT in your wallet.<br />Your world in view.</h2><p className="mt-6 max-w-100 text-sm leading-7 text-white/65">Hold USDT and see an estimated value in the local currency associated with your registration country.</p><ul className="mt-9 space-y-7">
            {[[ArrowUpRight, 'Send and receive USDT', 'External transfers are part of the intended product. Supported networks and transfer fees are still being finalised.'], [Layers3, 'Know what’s available', 'See available funds separately from amounts held in active trades or advertiser deposits.'], [ShieldCheck, 'Verify before you get started', 'Identity verification is required before wallet use or trading. Zetmond’s intended wallet is custodial.']].map(([Icon, title, description]) => <li className="flex gap-4" key={title}><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 text-lilac"><Icon size={18} strokeWidth={1.5} /></span><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-2 max-w-96 text-xs leading-6 text-white/60">{description}</p></div></li>)}
          </ul></div>
          <div className="wallet-world relative flex min-h-105 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/3 px-5 py-10 sm:px-9"><span className="text-center text-[9px] font-medium tracking-[.18em] text-lilac">ONE ASSET. A FAMILIAR PERSPECTIVE.</span><div className="usdt-orb my-9 grid size-34 place-items-center rounded-full text-[82px] font-semibold text-white" aria-hidden="true">₮</div><div className="relative z-10 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/20 bg-[#3a2752] p-5 shadow-xl"><div><span className="text-[8px] tracking-wider text-white/60">YOU HOLD</span><strong className="mt-2 block text-2xl font-medium">100 <small className="text-xs text-lilac">USDT</small></strong></div><span className="text-2xl text-lilac" aria-hidden="true">≈</span><div><span className="text-[8px] tracking-wider text-white/60">YOU CAN ESTIMATE</span><strong className="mt-2 block text-2xl font-medium">₦130,000</strong></div></div><p className="mt-6 text-center text-[10px] leading-5 text-white/55">Illustrative Nigeria display.<br />A currency estimate isn’t a spendable fiat balance.</p></div>
        </div>
      </section>

      <section id="fees" className="page-width section-space grid items-center gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-22">
        <div><Eyebrow>03 / THE NUMBERS, UP FRONT</Eyebrow><h2 className="section-title mt-5">Clear fees.<br />Before you pay.</h2><p className="mt-6 max-w-90 text-sm leading-7 text-muted">Each party pays a <strong className="font-semibold text-ink">0.5% platform fee</strong>, added to their deposit. Your agreed trade principal stays clearly separated from the fee.</p><Link className="inline-link mt-6" href="/vault-policy#fees">Read the fee and refund rules <ArrowUpRight size={16} /></Link><div className="mt-9 flex max-w-92 gap-3 border-t border-ink/10 pt-6"><Info size={17} className="mt-1 shrink-0 text-purple" /><p className="text-[11px] leading-6 text-muted">This is an illustrative calculation, not a live quote. The example rate is ₦1,300 per USDT. Separate bank charges are excluded; who pays successful collection and payout charges remains TBD.</p></div></div>
        <FeeCalculator />
      </section>

      <section className="page-width">
        <div className="grid gap-10 rounded-3xl bg-lavender px-6 py-10 md:grid-cols-[.85fr_1.15fr] md:gap-14 md:p-12">
          <div><Eyebrow>CLARITY ALSO MEANS A PLAN B</Eyebrow><h2 className="section-title mt-5 !text-[clamp(2.4rem,4vw,3.2rem)]">And if things<br />don’t go to plan?</h2><p className="mt-6 max-w-76 text-sm leading-7 text-muted">Payment status matters. The experience should tell you what happened and what comes next.</p></div>
          <div className="space-y-6">
            {[
              ['An incorrect fiat amount', 'Underpayments and overpayments cancel the trade. Received funds are returned, with applicable bank refund charges deducted from the buyer’s refund.'],
              ['A payment still being checked', 'Uncertain or pending payments at the deadline go into review. The trade won’t be shown as settled while those checks are unresolved.'],
              ['A payout that needs attention', 'USDT delivery and bank payout are tracked separately. A trade is complete only when both obligations are fulfilled.'],
            ].map(([title, description], index) => <article key={title} className={`flex gap-4 ${index > 0 ? 'border-t border-ink/10 pt-6' : ''}`}><span className="pt-1 text-[10px] font-medium text-purple">0{index + 1}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-6 text-muted">{description}</p></div></article>)}
          </div>
        </div>
      </section>

      <section id="faq" className="page-width section-space grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-22">
        <div><Eyebrow>04 / GOOD QUESTIONS</Eyebrow><h2 className="section-title mt-5">A little more<br />in the know.</h2><p className="mt-6 text-sm leading-7 text-muted">The details make a difference.<br />Here are a few worth knowing.</p><Link href="/vault-policy" className="inline-link mt-6">Explore the Vault policy <ArrowUpRight size={16} /></Link></div>
        <div className="border-t border-ink/15">{questions.map(([question, answer]) => <details className="faq-item group border-b border-ink/12" key={question}><summary className="flex min-h-19 cursor-pointer list-none items-center justify-between gap-5 py-5 text-[13px] font-medium">{question}<ChevronDown size={17} className="shrink-0 text-purple transition-transform group-open:rotate-180" /></summary><p className="pr-7 pb-6 text-xs leading-7 text-muted">{answer}</p></details>)}</div>
      </section>

      <section className="page-width">
        <div className="final-cta relative isolate flex flex-col justify-between gap-9 overflow-hidden rounded-3xl bg-purple px-7 py-12 text-white md:flex-row md:items-end md:px-13 md:py-14">
          <span className="absolute top-5 right-9 -z-10 text-[120px] leading-none text-white/15" aria-hidden="true">✳</span>
          <div><p className="eyebrow !text-[9px] text-white/75">YOUR NEXT TRADE, WITH MORE CLARITY.</p><h2 className="mt-5 font-display text-[clamp(2.6rem,4.8vw,4rem)] leading-[1.08] tracking-[-.04em]">Meet in the middle.<br />Move forward together.</h2><p className="mt-5 text-xs leading-6 text-white/75">Get to know the wallet and the Vault we’re building.</p></div>
          <div className="shrink-0"><button type="button" onClick={openPreview} className="button button-light">Explore Zetmond <ArrowUpRight size={18} /></button><p className="mt-3 text-center text-[10px] text-white/70">Prototype preview · No real funds</p></div>
        </div>
      </section>
    </main>
  );
}
