import Brand from "../../components/Brand";
import Link from "next/link";
export default function Policies() {
  return (
    <main className="standalone">
      <Brand />
      <p className="eyebrow">ZETMOND ACCOUNT POLICIES</p>
      <h1>Policies before launch.</h1>
      <p>
        Production terms and privacy notices require approval for each supported
        market. This test environment is for testing account access; it does not
        accept funds or provide live financial services.
      </p>
      <p>
        Account information includes your email, phone, country and security
        records. When sandbox identity verification is enabled, Smile ID
        collects the document, selfie and liveness capture. Zetmond stores the
        minimum verification evidence and history in encrypted records. Use only
        Smile ID’s approved sandbox test data, without real identity documents.
        Retention periods and the complete production disclosures remain under
        review.
      </p>
      <Link href="/register">Back to registration</Link>
    </main>
  );
}
