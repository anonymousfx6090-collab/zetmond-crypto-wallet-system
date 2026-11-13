import { Database } from "../db";
/** Delivery can repeat after a lost acknowledgement. Consumers deduplicate journalId. */
export class LedgerOutboxWorker {
  constructor(
    private db: Database,
    private mode: "sandbox" | "live",
    private deliver: (journalId: string) => Promise<void>,
  ) {}
  async dispatch() {
    const job = (
      await this.db.pool.query("SELECT * FROM finance.claim_outbox($1)", [
        this.mode,
      ])
    ).rows[0];
    if (!job) return false;
    await this.deliver(job.journal_id);
    await this.db.pool.query("SELECT finance.ack_outbox($1,$2)", [
      job.journal_id,
      job.generation,
    ]);
    return true;
  }
}
