import PolicyPage from '../../components/PolicyPage';

export const metadata = {
  title: 'Privacy — draft',
  description: 'Privacy information for the Zetmond marketing preview, with unresolved live-product policies clearly identified.',
};

export default function PrivacyPage() {
  return (
    <PolicyPage eyebrow="THE DETAILS / DRAFT" title="Privacy notice" description="This preview keeps the interaction simple. The live product’s data-handling policies still need to be defined and approved.">
      <h2>What this marketing preview collects</h2>
      <p>This page has no registration, payment, bank-detail, or identity-document form. The fee slider and Vault walkthrough run in your browser. They do not submit your choices to an application backend.</p>
      <p>The website does not include analytics, advertising trackers, or a mailing-list service. It does not use application cookies or local storage to save your interactions. Refreshing resets the interactive examples.</p>
      <h2>Hosting and technical requests</h2>
      <p>Loading a website sends technical requests to its server. Actual hosting arrangements, server logging, retention, and hosting-provider disclosures must be documented when deployment is chosen. This preview does not establish those policies.</p>
      <h2>Information the intended product may need</h2>
      <p>The intended customer app needs account information, registration country, contact-verification status, identity-verification records, bank-account ownership information, and transaction records. The approved collection fields and provider arrangements remain TBD.</p>
      <h2>Privacy decisions still open</h2>
      <ul>
        <li>The data controller’s identity and privacy contact details.</li>
        <li>Legal bases, country-specific disclosures, and customer eligibility.</li>
        <li>Verification providers, payment partners, and other data recipients.</li>
        <li>Storage locations, retention periods, and deletion procedures.</li>
        <li>Procedures for access, correction, complaints, and other applicable rights.</li>
        <li>Any future analytics, cookies, and consent requirements.</li>
      </ul>
      <h2>Before real information is collected</h2>
      <p>An approved privacy notice and the appropriate handling processes must be in place before the product collects live identity evidence or other customer data. Do not send personal documents or bank information through this marketing preview.</p>
    </PolicyPage>
  );
}
