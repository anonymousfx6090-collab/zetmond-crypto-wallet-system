import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  Res,
  Inject,
  HttpException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "./auth.service";
import { deploymentStage } from "../config";
import { markets, unavailableCountryMessage } from "../markets";
import {
  registerSchema,
  loginSchema,
  verifySchema,
  mfaSchema,
  resetSchema,
  changeSchema,
  stepSchema,
  email,
} from "./validation";
export const cookieName = (production: boolean) =>
  production ? "__Host-zetmond_session" : "zetmond_session";
@Controller("api")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  private value(req: Request) {
    return req.cookies?.[
      cookieName(this.auth.config.NODE_ENV === "production")
    ];
  }
  private input<T>(schema: z.ZodType<T>, body: unknown): T {
    const r = schema.safeParse(body);
    if (!r.success)
      throw new HttpException(
        {
          message: r.error.issues.some(
            (issue) =>
              issue.path[0] === "country" &&
              issue.message === unavailableCountryMessage,
          )
            ? unavailableCountryMessage
            : "Please check the highlighted fields.",
          fields: r.error.flatten().fieldErrors,
        },
        400,
      );
    return r.data;
  }
  private async respond(promise: Promise<any>, res: Response) {
    const result = await promise;
    if (result.error)
      throw new HttpException({ message: result.error }, result.status);
    const { sessionToken, maxAge, ...body } = result;
    if (sessionToken)
      res.cookie(
        cookieName(this.auth.config.NODE_ENV === "production"),
        sessionToken,
        {
          httpOnly: true,
          sameSite: "strict",
          secure: this.auth.config.NODE_ENV === "production",
          path: "/",
          maxAge,
        },
      );
    return body;
  }
  @Get("health") health() {
    return { status: "ok", deploymentStage: deploymentStage(this.auth.config) };
  }
  @Get("auth/policy") policy() {
    return {
      countries: markets,
      unavailableCountryMessage,
      termsVersion: this.auth.config.TERMS_VERSION,
      termsUrl: this.auth.config.TERMS_URL,
      privacyUrl: this.auth.config.PRIVACY_URL,
      development: this.auth.config.NODE_ENV !== "production",
      deploymentStage: deploymentStage(this.auth.config),
    };
  }
  @Post("auth/register") register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.register(
        this.input(registerSchema, body),
        req.get("user-agent") || "Unknown device",
      ),
      res,
    );
  }
  @Post("auth/login") login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.login(
        this.input(loginSchema, body),
        req.get("user-agent") || "Unknown device",
      ),
      res,
    );
  }
  @Get("auth/me") me(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.auth.me(this.value(req)), res);
  }
  @Post("auth/verify") verify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = this.input(verifySchema, body);
    return this.respond(
      this.auth.verify(this.value(req), d.purpose, d.code),
      res,
    );
  }
  @Post("auth/resend") resend(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = this.input(
      z.object({ purpose: z.literal("email") }).strict(),
      body,
    );
    return this.respond(this.auth.resend(this.value(req), d.purpose), res);
  }
  @Post("auth/forgot-password") forgot(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.forgot(this.input(z.object({ email }).strict(), body).email),
      res,
    );
  }
  @Post("auth/reset-password") reset(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = this.input(resetSchema, body);
    return this.respond(this.auth.reset(d.token, d.password), res);
  }
  @Post("auth/mfa/setup") setup(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.auth.setupMfa(this.value(req)), res);
  }
  @Post("auth/mfa/confirm") confirm(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.confirmMfa(this.value(req), this.input(mfaSchema, body).code),
      res,
    );
  }
  @Post("auth/mfa/verify") mfa(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.verifyMfa(this.value(req), this.input(mfaSchema, body).code),
      res,
    );
  }
  @Post("auth/step-up") step(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.stepUp(this.value(req), this.input(stepSchema, body)),
      res,
    );
  }
  @Post("auth/change-password") change(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.changePassword(this.value(req), this.input(changeSchema, body)),
      res,
    );
  }
  @Get("auth/sessions") sessions(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.auth.sessions(this.value(req)), res);
  }
  @Delete("auth/sessions/:id") revoke(
    @Param("id") id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      this.auth.revoke(this.value(req), this.input(z.string().uuid(), id)),
      res,
    );
  }
  @Post("auth/logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.respond(this.auth.revoke(this.value(req)), res);
    res.clearCookie(cookieName(this.auth.config.NODE_ENV === "production"), {
      path: "/",
      secure: this.auth.config.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
    });
    return body;
  }
  @Get("admin/access") admin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.auth.admin(this.value(req)), res);
  }
  @Get("account/financial-eligibility") financial(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.auth.financial(this.value(req)), res);
  }
}
