import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main id="main" className="page-width flex min-h-[55vh] flex-col items-start justify-center py-20">
      <p className="eyebrow text-purple">404 / A DIFFERENT DIRECTION</p>
      <h1 className="mt-5 font-display text-5xl tracking-tight sm:text-6xl">This page isn’t here.</h1>
      <p className="mt-6 text-muted">Let’s get you back to Zetmond.</p>
      <Link className="button button-primary mt-8" href="/"><ArrowLeft size={17} />Back to Zetmond</Link>
    </main>
  );
}
