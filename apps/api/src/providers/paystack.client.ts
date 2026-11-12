import { z } from "zod";
import { ConfigurationError } from "../config";

const apiOrigin = "https://api.paystack.co";
const pageSize = 100;
const catalogueLimit = 1000;
const responseLimit = 1024 * 1024;
const bankCodeSchema = z.string().regex(/^[a-zA-Z0-9]{1,80}$/);
const label = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((v) => !/[\p{Cc}\p{Cf}]/u.test(v));
const bankSchema = z.object({
  id: z.number().int().positive().safe(),
  code: bankCodeSchema,
  name: label,
  country: z.string().max(100),
  currency: z.string().max(10),
  type: z.string().max(40),
  active: z.boolean(),
  is_deleted: z.boolean().nullable(),
});
const catalogueSchema = z.object({
  status: z.literal(true),
  data: z.array(bankSchema).max(catalogueLimit),
  meta: z
    .object({
      next: z
        .string()
        .max(2048)
        .refine((v) => !/[\p{Cc}\p{Cf}]/u.test(v))
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});
const resolutionSchema = z.object({
  status: z.literal(true),
  data: z.object({
    account_number: z.string().regex(/^\d{10}$/),
    account_name: label,
    bank_id: z.number().int().positive().safe(),
  }),
});
type Bank = z.infer<typeof bankSchema>;
type Catalogue = {
  banks: Bank[];
  duplicateEntryCount: number;
  excludedAmbiguousCodeCount: number;
};
export type PaystackMode = "sandbox" | "live";
export type PaystackLookupFailure =
  | "invalid_request"
  | "authentication_failed"
  | "provider_unavailable"
  | "invalid_response";
const catalogueFields = {
  id: "catalogue_bank_id",
  code: "catalogue_bank_code",
  name: "catalogue_bank_name",
  country: "catalogue_bank_country",
  currency: "catalogue_bank_currency",
  type: "catalogue_bank_type",
  active: "catalogue_bank_active",
  is_deleted: "catalogue_bank_deleted",
} as const;
type FailureDetail =
  | (typeof catalogueFields)[keyof typeof catalogueFields]
  | "response_envelope"
  | "response_size"
  | "response_json"
  | "catalogue_shape"
  | "catalogue_size"
  | "catalogue_no_usable_banks"
  | "catalogue_pagination"
  | "catalogue_cursor_repeated"
  | "catalogue_page_limit"
  | "account_resolution";
export class PaystackLookupError extends Error {
  constructor(
    readonly code: PaystackLookupFailure,
    readonly detail?: FailureDetail,
  ) {
    super(
      `Paystack bank lookup failed (${code}${detail ? `: ${detail}` : ""}).`,
    );
    this.name = "PaystackLookupError";
  }
}

/** Server-only read-only transport. A resolved name is NOT bank ownership evidence.
 * This client cannot approve a destination, collect a payment or initiate a transfer.
 */
export class PaystackBankLookupClient {
  readonly mode: PaystackMode;
  #key: string;
  #transport: typeof fetch;
  #timeoutMs: number;
  constructor(
    credentials: { mode: PaystackMode; secretKey: string },
    transport: typeof fetch = fetch,
    timeoutMs = 10000,
  ) {
    const parsed = z
      .object({
        mode: z.enum(["sandbox", "live"]),
        secretKey: z.string().trim().min(20).max(4096),
      })
      .safeParse(credentials);
    if (
      !parsed.success ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 30000
    )
      throw new ConfigurationError(
        "Check PAYSTACK_MODE, PAYSTACK_SECRET_KEY and the bank lookup timeout.",
      );
    const expected =
      parsed.data.mode === "sandbox"
        ? /^sk_test_[a-zA-Z0-9]+$/
        : /^sk_live_[a-zA-Z0-9]+$/;
    if (!expected.test(parsed.data.secretKey))
      throw new ConfigurationError(
        "PAYSTACK_SECRET_KEY must be a server secret matching PAYSTACK_MODE (sandbox uses sk_test_). Public keys cannot be used.",
      );
    this.mode = parsed.data.mode;
    this.#key = parsed.data.secretKey;
    this.#transport = transport;
    this.#timeoutMs = timeoutMs;
  }
  private async request(
    path: "/bank" | "/bank/resolve",
    query: URLSearchParams,
  ): Promise<unknown> {
    const url = `${apiOrigin}${path}?${query}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let body: ReadableStream<Uint8Array> | null = null;
    try {
      const response = await this.#transport(url, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.#key}`,
          Accept: "application/json",
        },
      });
      body = response.body;
      if (response.status === 401 || response.status === 403)
        throw new PaystackLookupError("authentication_failed");
      if (response.status !== 200)
        throw new PaystackLookupError("provider_unavailable");
      if (
        response.redirected ||
        (response.url && response.url !== url) ||
        !response.body
      )
        throw new PaystackLookupError("invalid_response", "response_envelope");
      const contentLength = response.headers.get("content-length");
      if (
        contentLength &&
        (!/^\d+$/.test(contentLength) || Number(contentLength) > responseLimit)
      )
        throw new PaystackLookupError("invalid_response", "response_size");
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > responseLimit)
          throw new PaystackLookupError("invalid_response", "response_size");
        chunks.push(chunk.value);
      }
      if (controller.signal.aborted)
        throw new PaystackLookupError("provider_unavailable");
      try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new PaystackLookupError("invalid_response", "response_json");
      }
    } catch (error) {
      // Provider errors can contain keys, bank numbers, names or request URLs.
      throw error instanceof PaystackLookupError
        ? error
        : new PaystackLookupError("provider_unavailable");
    } finally {
      controller.abort();
      clearTimeout(timeout);
      try {
        await (reader ? reader.cancel() : body?.cancel());
      } catch {}
      reader?.releaseLock();
    }
  }
  private async catalogue(): Promise<Catalogue> {
    const selected = new Map<string, Bank>();
    const ambiguousCodes = new Set<string>();
    let duplicateEntryCount = 0;
    const cursors = new Set<string>();
    let cursor: string | undefined;
    let rowsSeen = 0;
    for (let page = 1; page <= 10; page++) {
      const query = new URLSearchParams({
        country: "nigeria",
        currency: "NGN",
        type: "nuban",
        use_cursor: "true",
        perPage: String(pageSize),
      });
      if (cursor) query.set("next", cursor);
      const result = catalogueSchema.safeParse(
        await this.request("/bank", query),
      );
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path[0] === "data" ? issue.path[2] : undefined;
        const detail: FailureDetail =
          typeof field === "string" && Object.hasOwn(catalogueFields, field)
            ? catalogueFields[field as keyof typeof catalogueFields]
            : issue.code === "too_big" &&
                issue.path.length === 1 &&
                issue.path[0] === "data"
              ? "catalogue_size"
              : "catalogue_shape";
        throw new PaystackLookupError("invalid_response", detail);
      }
      rowsSeen += result.data.data.length;
      if (rowsSeen > catalogueLimit)
        throw new PaystackLookupError("invalid_response", "catalogue_size");
      for (const bank of result.data.data) {
        if (
          bank.country.toLowerCase() === "nigeria" &&
          bank.currency === "NGN" &&
          bank.type === "nuban" &&
          bank.active &&
          !bank.is_deleted
        ) {
          if (ambiguousCodes.has(bank.code)) {
            duplicateEntryCount++;
            continue;
          }
          const existing = selected.get(bank.code);
          if (existing) {
            duplicateEntryCount++;
            // Matching ID and label identify a repeated record. A conflicting
            // code stays excluded for this entire catalogue, regardless of order.
            if (existing.id !== bank.id || existing.name !== bank.name) {
              selected.delete(bank.code);
              ambiguousCodes.add(bank.code);
            }
            continue;
          }
          selected.set(bank.code, bank);
        }
      }
      const meta = result.data.meta;
      if ((meta && !Object.hasOwn(meta, "next")) || (cursor && !meta))
        throw new PaystackLookupError(
          "invalid_response",
          "catalogue_pagination",
        );
      const next = meta?.next;
      // The published response schema also permits a full, data-only catalogue.
      // Its size is not proof of another page; only an explicit cursor advances it.
      if (!next)
        return {
          banks: [...selected.values()],
          duplicateEntryCount,
          excludedAmbiguousCodeCount: ambiguousCodes.size,
        };
      if (cursors.has(next))
        throw new PaystackLookupError(
          "invalid_response",
          "catalogue_cursor_repeated",
        );
      cursors.add(next);
      cursor = next;
    }
    throw new PaystackLookupError("invalid_response", "catalogue_page_limit");
  }
  async listNigerianBanks(): Promise<{ code: string; name: string }[]> {
    return (await this.catalogue()).banks.map(({ code, name }) => ({
      code,
      name,
    }));
  }
  async getNigerianBankCatalogueSummary(): Promise<{
    bankCount: number;
    duplicateEntryCount: number;
    excludedAmbiguousCodeCount: number;
  }> {
    const { banks, ...summary } = await this.catalogue();
    return { bankCount: banks.length, ...summary };
  }
  async resolveNigerianAccount(input: {
    bankCode: string;
    accountNumber: string;
  }): Promise<{
    bankCode: string;
    accountNumber: string;
    accountName: string;
  }> {
    const parsed = z
      .object({
        bankCode: bankCodeSchema,
        accountNumber: z.string().regex(/^\d{10}$/),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw new PaystackLookupError("invalid_request");
    const bank = (await this.catalogue()).banks.find(
      (v) => v.code === parsed.data.bankCode,
    );
    if (!bank) throw new PaystackLookupError("invalid_request");
    const query = new URLSearchParams({
      account_number: parsed.data.accountNumber,
      bank_code: parsed.data.bankCode,
    });
    const result = resolutionSchema.safeParse(
      await this.request("/bank/resolve", query),
    );
    if (
      !result.success ||
      result.data.data.account_number !== parsed.data.accountNumber ||
      result.data.data.bank_id !== bank.id
    )
      throw new PaystackLookupError("invalid_response", "account_resolution");
    return {
      bankCode: bank.code,
      accountNumber: result.data.data.account_number,
      accountName: result.data.data.account_name,
    };
  }
}
