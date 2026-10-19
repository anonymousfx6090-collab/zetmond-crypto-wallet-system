import PolicyPage from '../../components/PolicyPage';

export const metadata = {
  title: 'Terms — draft',
  description: 'Draft terms placeholder for the Zetmond marketing site. Live-service terms have not been approved.',
};

export default function TermsPage() {
  return (
    <PolicyPage eyebrow="THE DETAILS / DRAFT" title="Terms of service" description="A place for clear terms, before a live product. Here is what applies to this preview and what still needs to be defined.">
      <h2>About this preview</h2>
      <p>This website introduces the intended Zetmond USDT wallet and P2P Vault. It uses fictional balances and illustrative examples. It does not open customer accounts, accept money, process live trades, or collect identity documents.</p>
      <h2>What the product is intended to do</h2>
      <p>The intended product is a custodial USDT wallet with fixed-rate P2P trading. Approved identity verification is required before wallet or trading use. The Vault coordinates the seller’s USDT funding and buyer’s fiat funding, then tracks delivery to each recipient.</p>
      <p>The public product explanation does not establish country eligibility, provider approval, network support, or a guaranteed launch date.</p>
      <h2>Illustrations and fee examples</h2>
      <p>The example rate of ₦1,300 per USDT is illustration data. It is not a live rate or offer. The example slider range does not define approved trade limits.</p>
      <p>Each party’s 0.5% platform fee is a confirmed product rule. Other charges and policies remain partly unresolved. See the Vault & fee rules for the distinction between agreed rules and open decisions.</p>
      <h2>Terms still to be approved</h2>
      <ul>
        <li>The legal operating entity, contact details, jurisdiction, and governing terms.</li>
        <li>Supported countries, customer eligibility, and identity-verification requirements.</li>
        <li>Custody arrangements, supported USDT networks, and external-transfer fees.</li>
        <li>Account restrictions, recovery rules, dispute handling, and liability allocation.</li>
        <li>Settlement exceptions, reversal recovery, and complaints or appeals procedures.</li>
      </ul>
      <h2>Before live use</h2>
      <p>Approved service terms and relevant disclosures must replace this placeholder before real customer funds or live identity verification are enabled.</p>
    </PolicyPage>
  );
}
