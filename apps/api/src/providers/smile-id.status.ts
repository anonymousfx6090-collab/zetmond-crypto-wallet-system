import { z } from "zod";
import { smileIdJobIdSchema, smileIdUserIdSchema } from "./smile-id.document";

const lookupSchema = z
  .object({
    jobId: smileIdJobIdSchema,
    userId: smileIdUserIdSchema,
  })
  .strict();
export type SmileIdStatusLookup = z.infer<typeof lookupSchema>;
const terminalStates = ["clear", "block", "attention", "error"] as const;
const statusSchema = z.object({
  status: z.enum(["processing", ...terminalStates]),
  job_id: smileIdJobIdSchema,
  user_id: z.string().min(1).max(200),
  created_at: z.string().datetime({ offset: true }),
});
type Tracking = {
  jobId: string;
  userId: string;
  // The status response generation time, not an identity-verification timestamp
  // or a provider decision revision. Never use it to grant fresh eligibility.
  responseGeneratedAt: string;
};
export type SmileIdJobStatus = Tracking &
  (
    | { phase: "processing"; status: "processing" }
    | { phase: "terminal"; status: (typeof terminalStates)[number] }
  );
export class SmileIdStatusError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "unavailable"
      | "invalid_response"
      | "not_found"
      | "provider_error",
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}
/** Lookups must come from the persisted current operation, not browser input. */
export function prepareSmileIdStatusLookup(input: SmileIdStatusLookup) {
  const result = lookupSchema.safeParse(input);
  if (!result.success)
    throw new SmileIdStatusError(
      "invalid_request",
      "Provide the stored Smile ID job reference and its expected user.",
    );
  return result.data;
}
/** Tracking only: no identity evidence, approval or eligibility is derived here. */
export function parseSmileIdStatus(
  data: Record<string, unknown>,
  httpStatus: 200 | 202,
  expected: SmileIdStatusLookup,
): SmileIdJobStatus {
  const result = statusSchema.safeParse(data);
  if (
    !result.success ||
    result.data.job_id !== expected.jobId ||
    result.data.user_id !== expected.userId ||
    (httpStatus === 202) !== (result.data.status === "processing")
  )
    throw new SmileIdStatusError(
      "invalid_response",
      "Smile ID status is invalid, inconsistent or bound to another job/user.",
    );
  const d = result.data;
  const tracking = {
    jobId: d.job_id,
    userId: d.user_id,
    responseGeneratedAt: d.created_at,
  };
  return d.status === "processing"
    ? { ...tracking, phase: "processing", status: "processing" }
    : { ...tracking, phase: "terminal", status: d.status };
}
