import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  Inject,
} from "@nestjs/common";
import { Request } from "express";
import { z } from "zod";
import { cookieName } from "../auth/auth.controller";
import { VerificationService, bankInput, fail } from "./verification.service";
import {
  smileIdJobIdSchema,
  smileIdUserIdSchema,
} from "../providers/smile-id.document";
const disclosure = z
  .object({ disclosureVersion: z.string().min(1).max(80) })
  .strict();
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const value = schema.safeParse(body);
  if (!value.success) return fail("Check the supplied verification details.");
  return value.data;
}
@Controller("api")
export class VerificationController {
  constructor(
    @Inject(VerificationService) private service: VerificationService,
  ) {}
  private session(req: Request) {
    return req.cookies?.[
      cookieName(this.service.auth.config.NODE_ENV === "production")
    ];
  }
  @Get("identity") identity(@Req() req: Request) {
    return this.service.identity(this.session(req));
  }
  @Post("identity/sessions") start(@Req() req: Request, @Body() body: unknown) {
    return this.service.startIdentity(
      this.session(req),
      parse(disclosure, body).disclosureVersion,
    );
  }
  @Post("identity/resubmissions") resubmit(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.service.startIdentity(
      this.session(req),
      parse(disclosure, body).disclosureVersion,
      true,
    );
  }
  @Post("identity/refresh") refresh(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    parse(z.object({}).strict(), body);
    return this.service.refreshIdentity(this.session(req));
  }
  @Get("banks") banks(@Req() req: Request) {
    return this.service.banks(this.session(req));
  }
  @Post("identity/capture") capture(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const input = parse(
      z.object({ attemptId: z.string().uuid() }).strict(),
      body,
    );
    return this.service.browserCapture(this.session(req), input.attemptId);
  }
  @Post("identity/capture/submission") submitted(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const input = parse(
      z
        .object({
          attemptId: z.string().uuid(),
          jobId: smileIdJobIdSchema.optional(),
          userId: smileIdUserIdSchema.optional(),
        })
        .strict()
        .refine((v) => !!v.jobId === !!v.userId),
      body,
    );
    return this.service.browserSubmission(this.session(req), input);
  }
  @Post("banks") add(@Req() req: Request, @Body() body: unknown) {
    const { stepUpId, ...input } = parse(
      bankInput.extend({ stepUpId: z.string().uuid() }).strict(),
      body,
    );
    return this.service.addBank(this.session(req), input, stepUpId);
  }
  @Post("banks/:id/verifications") retry(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    parse(z.object({}).strict(), body);
    return this.service.retryBank(
      this.session(req),
      parse(z.string().uuid(), id),
    );
  }
  @Post("banks/:id/reverifications/prepare") prepareReverification(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z.object({ operationId: z.string().uuid() }).strict(),
      body,
    );
    return this.service.prepareBankReverification(
      this.session(req),
      parse(z.string().uuid(), id),
      input.operationId,
    );
  }
  @Post("banks/:id/reverifications") reverify(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z
        .object({ operationId: z.string().uuid(), stepUpId: z.string().uuid() })
        .strict(),
      body,
    );
    return this.service.reverifyBank(
      this.session(req),
      parse(z.string().uuid(), id),
      input.operationId,
      input.stepUpId,
    );
  }
}
