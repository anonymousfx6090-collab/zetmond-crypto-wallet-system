import "reflect-metadata";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import { Config, loadConfig } from "./config";
import { Database } from "./db";
import { Delivery } from "./delivery/delivery.service";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import { VerificationService } from "./verification/verification.service";
import { VerificationWorker } from "./verification/verification.worker";
import { VerificationController } from "./verification/verification.controller";
import {
  configuredVerificationProviders,
  VerificationProvider,
} from "./providers/verification";
@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status === 500)
      console.error(
        "API request failed; investigate database/provider health without logging request secrets",
      );
    res.status(status).json(
      error instanceof HttpException
        ? error.getResponse()
        : {
            message: "Service temporarily unavailable. Please retry safely.",
          },
    );
  }
}
export async function createApp(
  config: Config = loadConfig(),
  testProviders?: VerificationProvider[],
) {
  if (testProviders && config.NODE_ENV !== "test")
    throw new Error("Fixture providers are test-only");
  const db = new Database(config.DATABASE_URL),
    delivery = new Delivery(db, config),
    auth = new AuthService(db, config, delivery);
  const verification = new VerificationService(
    auth,
    testProviders || configuredVerificationProviders(),
  );
  const verificationWorker = new VerificationWorker(verification);
  @Module({
    controllers: [AuthController, VerificationController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: VerificationService, useValue: verification },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.use(helmet(), cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  // Only registered provider routes bypass browser CSRF. Verify untouched raw bytes first.
  for (const provider of verification.providers) {
    if (provider.mode !== verification.mode) continue;
    app
      .getHttpAdapter()
      .getInstance()
      .post(
        `/api/webhooks/${provider.id}`,
        express.raw({ type: "*/*", limit: "64kb" }),
        async (req: Request, res: Response) => {
          try {
            if (!Buffer.isBuffer(req.body))
              return res
                .status(400)
                .json({ message: "Invalid verification event." });
            return res.json(
              await verification.webhook(provider, req.body, req.headers),
            );
          } catch (error) {
            return res
              .status(error instanceof HttpException ? error.getStatus() : 503)
              .json({ message: "Verification event was not accepted." });
          }
        },
      );
  }
  app.use(express.json({ limit: "16kb" }));
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (
      req.get("origin") !== config.APP_ORIGIN ||
      req.get("x-zetmond-request") !== "1"
    )
      return res.status(403).json({ message: "Untrusted request origin." });
    try {
      // Never trust client X-Forwarded-For headers; deployment ingress must enforce its own rate limits too.
      if (!(await auth.rate(`${req.socket.remoteAddress}:${req.path}`)))
        return res
          .status(429)
          .json({ message: "Too many requests. Please try again later." });
      if (
        typeof req.body?.email === "string" &&
        !(await auth.rate(
          `email:${req.path}:${req.body.email.trim().toLowerCase().slice(0, 254)}`,
        ))
      )
        return res
          .status(429)
          .json({ message: "Too many requests. Please try again later." });
      next();
    } catch {
      return res
        .status(503)
        .json({ message: "Service temporarily unavailable." });
    }
  });
  app.useGlobalFilters(new SafeErrors());
  await app.init();
  return {
    app,
    db,
    auth,
    delivery,
    verification,
    verificationWorker,
    async close() {
      await app.close();
      await db.close();
    },
  };
}
