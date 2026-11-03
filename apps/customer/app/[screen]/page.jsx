import { notFound } from "next/navigation";
import AccountApp from "../../components/AccountApp";
const screens = [
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-contacts",
  "mfa",
  "mfa-setup",
  "account",
  "security",
  "sessions",
  "admin-access",
];
export default async function Page({ params }) {
  const { screen } = await params;
  if (!screens.includes(screen)) notFound();
  return <AccountApp key={screen} screen={screen} />;
}
