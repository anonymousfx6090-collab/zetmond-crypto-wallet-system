import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <p className="eyebrow">ZETMOND</p>
      <h1>This page isn’t here.</h1>
      <p>Return to your account to continue.</p>
      <Link href="/login">Go to sign in</Link>
    </main>
  );
}
