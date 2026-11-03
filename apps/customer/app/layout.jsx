import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import ThemeProvider from "../../../marketing/components/ThemeProvider";
import { themeInitScript } from "../../../marketing/components/theme-init";
import "./globals.css";
export const metadata = {
  title: { default: "Your account | Zetmond", template: "%s | Zetmond" },
  description: "Secure access to your Zetmond account.",
  icons: { icon: "/zetmond-logo.png" },
  robots: { index: false, follow: false },
};
export const viewport = { themeColor: "#0e0d12" };
export default function Layout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
