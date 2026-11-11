import { HttpException } from "@nestjs/common";
import { PoolClient } from "pg";
import { AuthService } from "../auth/auth.service";
import { isSupportedCountry, unavailableCountryMessage } from "../markets";
export class Eligibility {
  constructor(private auth: AuthService) {}
  async customer(c: PoolClient, session?: string) {
    const user = await this.auth.current(c, session);
    if (!user)
      throw new HttpException({ message: "Sign in to continue." }, 401);
    if (user.role !== "customer")
      throw new HttpException({ message: "Customer access required." }, 403);
    return user;
  }
  identity(user: any) {
    if (!isSupportedCountry(user.country))
      throw new HttpException({ message: unavailableCountryMessage }, 403);
    if (!user.email_verified)
      throw new HttpException(
        { message: "Verify your email before verifying your identity." },
        403,
      );
    if (user.kyc_status === "restricted")
      throw new HttpException(
        { message: "Identity verification is restricted. Contact support." },
        403,
      );
  }
  bank(user: any) {
    this.identity(user);
    if (user.kyc_status !== "approved")
      throw new HttpException(
        { message: "Verify your identity before adding a bank account." },
        403,
      );
    if (!user.mfa_secret)
      throw new HttpException(
        { message: "Set up your authenticator before adding a bank account." },
        403,
      );
  }
}
