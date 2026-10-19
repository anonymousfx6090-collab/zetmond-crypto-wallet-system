import SiteShell from '../components/SiteShell';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './globals.css';

export const metadata = {
  title: {
    default: 'Zetmond — Your USDT. A clearer way to trade.',
    template: '%s | Zetmond',
  },
  description: 'Meet Zetmond: a USDT wallet and a clearer way to trade. Explore our two-sided Vault, transparent fees, and fixed-rate P2P experience.',
  icons: { icon: '/zetmond-logo.png' },
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#0e0d12' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
