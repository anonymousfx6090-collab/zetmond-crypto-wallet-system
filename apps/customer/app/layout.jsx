import "./globals.css";
export const metadata = {
  title: { default: "Your account | Zetmond", template: "%s | Zetmond" },
  description: "Secure access to your Zetmond account.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
