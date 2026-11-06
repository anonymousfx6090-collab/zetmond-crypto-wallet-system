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
        records. Do not upload identity documents here. Retention periods and
        the complete production disclosures remain under review.
      </p>
      <Link href="/register">Back to registration</Link>
    </main>
  );
}
