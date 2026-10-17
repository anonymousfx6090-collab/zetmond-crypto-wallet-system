import PolicyPage from '../../components/PolicyPage';

export const metadata = {
  title: 'Vault & fee rules',
  description: 'Understand Zetmond’s confirmed Vault funding rules, 0.5% fees, funding windows, settlement obligations, and refunds.',
};

export default function VaultPolicyPage() {
  return (
    <PolicyPage productRules eyebrow="THE DETAILS / PRODUCT RULES" title="The Vault, explained." description="The agreed rules behind funding, fees, settlement, and refunds. Clear amounts and truthful payment status come first.">
      <h2>Both sides fund the Vault</h2>
      <p>The buyer pays a trade-specific Vault fiat collection account. The seller funds the exact required USDT amount from their Zetmond wallet. The seller’s bank account is the payout destination, not the buyer’s funding destination.</p>
      <p>Either party may fund first. P2P USDT funding and receipt use Zetmond wallets. Ordinary external-wallet transfers are a separate flow.</p>
      <h2 id="fees">The 0.5% platform fee</h2>
      <p><strong>Each party pays 0.5%, added to their required deposit.</strong> The seller pays the fee in USDT and the buyer pays it in the trade’s fiat currency. The invoice itemises principal, fee, and total before payment.</p>
      <p>For an illustrative trade of 10 USDT at ₦1,300 per USDT, the seller deposits 10.05 USDT and the buyer deposits ₦13,065. The buyer’s entitlement is 10 USDT; the seller’s fiat principal entitlement is ₦13,000.</p>
      <p>Separate bank charges are excluded from that example. Who pays successful collection and payout charges, and the resulting net bank receipt, remain <strong>TBD</strong>. Precision, rounding, minimum fees, minimum orders, and taxes also remain TBD.</p>
      <h2 id="timers">The funding windows</h2>
      <ul>
        <li>Once the final agreement is active and neither party has paid, the unfunded window is <strong>20 minutes</strong>.</li>
        <li>The first qualifying payment replaces that deadline with a fresh <strong>15-minute window</strong> for the other party.</li>
        <li>If the first qualifying payment occurs at minute 19, the new deadline is minute 34.</li>
        <li>If neither side funds, the trade expires. No received funds means no refund is needed.</li>
        <li>If only one side funds, expiry leads to cancellation and return of received funds after checking for pending payments.</li>
        <li>Pending or uncertain payment at the deadline enters review, preventing a simultaneous refund and settlement.</li>
      </ul>
      <p>The acceptance mechanism, exact trusted event that qualifies as payment, deadline-boundary treatment, and late notification rules remain <strong>TBD</strong>. A user assertion or uploaded screenshot does not prove receipt.</p>
      <h2>Incorrect amounts and cancellation</h2>
      <p>An incorrect in-app USDT funding amount is blocked and the required amount is shown. A fiat underpayment or overpayment cancels the trade and triggers the applicable returns; the flow does not invite a top-up or silently change the trade amount.</p>
      <p>Users cannot cancel after either party pays. Manual cancellation before any funding remains <strong>TBD</strong>. System cancellation and administrative exception handling are separate processes.</p>
      <h2 id="refunds">Returning received funds</h2>
      <p><strong>No platform fee is retained on cancelled trades.</strong> The seller’s received USDT, including the fee portion, is returned to their Zetmond wallet. The buyer’s received fiat, including the fee portion, is returned to the verified originating bank account, less applicable bank refund charges.</p>
      <p>Refunds are tracked separately and are not shown as complete while pending or failed. No refund completion time has been approved. If the refund bank charge equals or exceeds the received amount, or the original payer cannot be verified, the handling policy remains TBD.</p>
      <h2>Settlement has two obligations</h2>
      <p>Both exact deposits must qualify before settlement. The Vault then coordinates delivery of USDT principal to the buyer’s Zetmond wallet and fiat principal, subject to separately approved charges, to the seller’s verified bank account.</p>
      <p><strong>The trade is complete only after both deliveries succeed.</strong> No additional seller release approval is needed. If one delivery succeeds and the other fails, the outstanding obligation needs recovery; successful delivery is preserved and must not be duplicated.</p>
      <h2>Payments needing extra review</h2>
      <p>Late payments are linked to the original order for return or review; they do not automatically revive a cancelled trade. Split payments, extra transfers, source-name mismatches, post-settlement reversals, and retry limits require further policy decisions.</p>
      <h2>Other open decisions</h2>
      <p>Supported settlement markets, payment-provider eligibility, USDT networks, custody design, external-transfer fees, advertiser thresholds, and administrator financial authority remain unresolved. Displaying a local-currency estimate does not activate P2P trading in that market.</p>
    </PolicyPage>
  );
}
