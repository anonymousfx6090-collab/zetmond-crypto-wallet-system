import { z } from "zod";
import { smileIdJobIdSchema } from "./smile-id.document";
import { SmileIdStatusLookup } from "./smile-id.status";

export type SmileIdReplayAccepted = {
  status: "accepted";
  jobId: string;
  userId: string;
};
/** not_queued applies only to this replay request, not to the original job or
 * an earlier replay. Unknown outcomes must be reconciled before another POST.
 */
export class SmileIdReplayError extends Error {
  constructor(
    readonly outcome: "not_queued" | "unknown",
    readonly code:
      | "invalid_request"
      | "lookup_failed"
      | "not_terminal"
      | "authentication_unavailable"
      | "unavailable"
      | "not_found"
      | "provider_error"
      | "invalid_response",
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}
const acceptanceSchema = z.object({
  status: z.literal("accepted"),
  job_id: smileIdJobIdSchema,
  user_id: z.string().min(1).max(200),
  message: z.string(),
});
export function parseSmileIdReplayAcceptance(
  data: Record<string, unknown>,
  expected: SmileIdStatusLookup,
): SmileIdReplayAccepted {
  const result = acceptanceSchema.safeParse(data);
  if (
    !result.success ||
    result.data.job_id !== expected.jobId ||
    result.data.user_id !== expected.userId
  )
    throw new SmileIdReplayError(
      "unknown",
      "invalid_response",
      "Smile ID replay acknowledgement is invalid or bound to another job/user; reconcile before retrying.",
      202,
    );
  return { status: "accepted", jobId: expected.jobId, userId: expected.userId };
}
