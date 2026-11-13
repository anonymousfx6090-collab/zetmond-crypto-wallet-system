import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "../src/db";
import { migrate } from "../src/migrate";
import { LedgerService, JournalInput } from "../src/ledger/ledger.service";
import { LedgerOutboxWorker } from "../src/ledger/outbox-worker";
import {
  FinancialOperations,
  transferDigest,
} from "../src/financial-operations/operations.service";
import { AuthService } from "../src/auth/auth.service";
import { Delivery } from "../src/delivery/delivery.service";
import { loadConfig } from "../src/config";
import { hash, digest, seal } from "../src/crypto";
import { checkLedgerReadiness } from "../src/check-ledger";
import {
  CustodyPort,
  TransferIntent,
  SignedTransfer,
  DecodedTransfer,
  CustodyStatus,
} from "../src/custody/custody.port";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must end in _test");
const owner = new Database(url);
const runtimeUrl = new URL(url);
runtimeUrl.username = "zetmond_finance_fixture";
runtimeUrl.password = "local-finance-fixture-only";
const db = new Database(runtimeUrl.toString());
const operatorUrl = new URL(url);
operatorUrl.username = "zetmond_operator_fixture";
operatorUrl.password = "local-operator-fixture-only";
const operatorDb = new Database(operatorUrl.toString());
const key = randomBytes(32).toString("hex");
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: runtimeUrl.toString(),
  DATA_ENCRYPTION_KEY: key,
});
const auth = new AuthService(db, config, new Delivery(db, config));
const ledger = new LedgerService(db);
const operatorAuth = new AuthService(
  operatorDb,
  config,
  new Delivery(operatorDb, config),
);
const address = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
let customer: string,
  other: string,
  asset: string,
  liveAsset: string,
  available: string,
  held: string,
  tradeHeld: string,
  custody: string,
  feeAccount: string,
  session: string,
  identityAttemptId: string,
  sessionId: string;
before(async () => {
  await migrate(url);
  await owner.pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='zetmond_finance_fixture') THEN CREATE ROLE zetmond_finance_fixture LOGIN PASSWORD 'local-finance-fixture-only'; END IF; END $$",
  );
  await owner.pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='zetmond_operator_fixture') THEN CREATE ROLE zetmond_operator_fixture LOGIN PASSWORD 'local-operator-fixture-only'; END IF; END $$",
  );
  await owner.pool.query(
    "GRANT USAGE ON SCHEMA finance TO zetmond_finance_fixture; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO zetmond_finance_fixture; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO zetmond_finance_fixture",
  );
  await owner.pool.query(
    "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance FROM zetmond_finance_fixture,zetmond_operator_fixture",
  );
  await owner.pool.query(
    readFileSync(
      join(__dirname, "../scripts/grant-finance-runtime.sql"),
      "utf8",
    ).replaceAll(':"runtime_role"', "zetmond_finance_fixture"),
  );
  await owner.pool.query(
    readFileSync(
      join(__dirname, "../scripts/grant-finance-operator.sql"),
      "utf8",
    ).replaceAll(':"operator_role"', "zetmond_operator_fixture"),
  );
});
beforeEach(async () => {
  await owner.pool.query(
    "TRUNCATE finance.assets CASCADE; TRUNCATE finance.events,finance.reconciliation_runs CASCADE",
  );
  customer = randomUUID();
  other = randomUUID();
  asset = randomUUID();
  liveAsset = randomUUID();
  available = randomUUID();
  held = randomUUID();
  tradeHeld = randomUUID();
  custody = randomUUID();
  feeAccount = randomUUID();
  session = randomUUID();
  sessionId = randomUUID();
  for (const id of [customer, other]) {
    await owner.pool.query(
      "INSERT INTO users(id,email,password_hash,country,email_verified,kyc_status,mfa_secret) VALUES($1,$2,'fixture-only','NG',true,'approved',$3)",
      [id, `${id}@fixture.test`, seal(key, "fixture-mfa")],
    );
    const caseId = randomUUID(),
      attemptId = randomUUID();
    if (id === customer) identityAttemptId = attemptId;
    await owner.pool.query(
      "INSERT INTO identity_cases(id,user_id) VALUES($1,$2)",
      [caseId, id],
    );
    await owner.pool.query(
      "INSERT INTO identity_attempts(id,case_id,provider,mode,country,status,revision,evidence_payload) VALUES($1,$2,'fixture','sandbox','NG','approved',1,$3)",
      [attemptId, caseId, seal(key, { legalName: "Fixture Customer" })],
    );
    await owner.pool.query(
      "UPDATE identity_cases SET current_attempt_id=$1 WHERE id=$2",
      [attemptId, caseId],
    );
  }
  await owner.pool.query(
    "INSERT INTO sessions(id,user_id,token_hash,mfa_verified,expires_at,user_agent) VALUES($1,$2,$3,true,now()+interval '1 hour','fixture')",
    [sessionId, customer, hash(session)],
  );
  await owner.pool.query(
    "INSERT INTO finance.assets(id,code,network,mode,decimals,contract_ref) VALUES($1,'USDT_TEST','tron-nile','sandbox',6,$3),($2,'USDT','tron-mainnet','live',6,$3)",
    [asset, liveAsset, address],
  );
  for (const [id, purpose] of [
    [available, "available"],
    [held, "withdrawal_held"],
    [tradeHeld, "trade_held"],
  ] as const)
    await ledger.createAccount({
      id,
      assetId: asset,
      ownerId: customer,
      purpose,
      normalSide: "credit",
      nonnegative: true,
    });
  await ledger.createAccount({
    id: custody,
    assetId: asset,
    ownerId: null,
    purpose: "custody",
    normalSide: "debit",
    nonnegative: true,
  });
  await ledger.createAccount({
    id: feeAccount,
    assetId: asset,
    ownerId: null,
    purpose: "fee_liability",
    normalSide: "credit",
    nonnegative: true,
  });
});
after(async () => {
  await db.close();
  await operatorDb.close();
  await owner.close();
});
function posting(amount = "1000000"): JournalInput {
  return {
    id: randomUUID(),
    assetId: asset,
    operationId: randomUUID(),
    key: randomUUID(),
    kind: "test_fixture",
    legs: [
      { accountId: custody, side: "debit", units: amount },
      { accountId: available, side: "credit", units: amount },
    ],
  };
}
async function balances() {
  return Object.fromEntries(
    (await ledger.balancesForCustomer(customer, "sandbox")).map((v) => [
      v.purpose,
      v.units,
    ]),
  );
}
async function fund(amount = "1000000") {
  await ledger.post(posting(amount));
}
function intent(): TransferIntent {
  return {
    id: randomUUID(),
    assetId: asset,
    availableId: available,
    heldId: held,
    feeAccountId: feeAccount,
    custodyAccountId: custody,
    identityAttemptId,
    identityRevision: "1",
    mode: "sandbox",
    network: "tron-nile",
    contract: address,
    destination: address,
    keyRef: "fixture-key",
    units: "600000",
    feeUnits: "10000",
    quoteId: randomUUID(),
    policyVersion: "fixture-policy",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
}
async function grant(v: TransferIntent) {
  const id = randomUUID();
  await owner.pool.query(
    "INSERT INTO step_ups(id,session_id,purpose,operation_digest,expires_at) VALUES($1,$2,'withdrawal',$3,now()+interval '5 minutes')",
    [id, sessionId, digest(key, transferDigest(v))],
  );
  return id;
}
class FixtureCustody implements CustodyPort {
  readonly kind = "fixture";
  readonly mode = "sandbox";
  readonly providerId = "fixture";
  readonly canRebroadcastSameTransaction = true;
  prepared = new Map<string, SignedTransfer>();
  broadcasts = new Set<string>();
  signCalls = 0;
  broadcastCalls = 0;
  loseBroadcast = false;
  finalState: CustodyStatus["state"] = "not_found";
  wrongDestination = false;
  authorizationCalls = 0;
  ready() {
    return true;
  }
  async authorizeIntent(v: TransferIntent) {
    this.authorizationCalls++;
    if (v.policyVersion !== "fixture-policy")
      throw new Error("fixture quote rejected");
  }
  async prepare(v: TransferIntent) {
    this.signCalls++;
    let signed = this.prepared.get(v.id);
    if (!signed) {
      const payload = JSON.stringify({
        operationId: v.id,
        mode: v.mode,
        network: v.network,
        contract: v.contract,
        destination: this.wrongDestination ? "tampered" : v.destination,
        units: v.units,
        keyRef: v.keyRef,
        policyVersion: v.policyVersion,
        expiresAt: v.expiresAt,
        signatureValid: true,
      });
      signed = {
        payload,
        transactionRef: createHash("sha256").update(payload).digest("hex"),
      };
      this.prepared.set(v.id, signed);
    }
    return signed;
  }
  async decode(s: SignedTransfer): Promise<DecodedTransfer> {
    if (
      createHash("sha256").update(s.payload).digest("hex") !== s.transactionRef
    )
      throw new Error("bad fixture hash");
    return { ...JSON.parse(s.payload), transactionRef: s.transactionRef };
  }
  async lookup(s: SignedTransfer) {
    return {
      state: this.finalState,
      transactionRef: s.transactionRef,
      decoded: await this.decode(s),
      evidenceRef: "fixture-canonical-reference",
    };
  }
  async broadcast(s: SignedTransfer) {
    this.broadcastCalls++;
    this.broadcasts.add(s.transactionRef);
    if (this.loseBroadcast) {
      this.loseBroadcast = false;
      throw new Error("fixture response lost");
    }
  }
  async authenticateEvent(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (headers["fixture-signature"] !== hash(raw.toString("base64")))
      throw new Error("forged fixture event");
    return { eventRef: JSON.parse(raw.toString()).id, mode: this.mode };
  }
  async positions() {
    return [
      {
        accountId: custody,
        units: "1000000",
        evidenceRef: "fixture-balance-proof",
      },
    ];
  }
}
test("posting is exact, idempotent and immutable with one durable outbox event", async () => {
  const j = posting("9007199254740993123456");
  await ledger.post(j);
  await ledger.post({ ...j, id: randomUUID() });
  assert.equal((await balances()).available, "9007199254740993123456");
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.journals")).rows[0]
      .count,
    "1",
  );
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.outbox")).rows[0]
      .count,
    "1",
  );
  await assert.rejects(
    ledger.post({
      ...j,
      legs: [
        { ...j.legs[0], units: "1" },
        { ...j.legs[1], units: "1" },
      ],
    }),
  );
  await assert.rejects(owner.pool.query("UPDATE finance.entries SET units=1"));
  await assert.rejects(owner.pool.query("DELETE FROM finance.journals"));
});
test("raw runtime writes, private posting functions and owner-role financial calls are denied", async () => {
  await assert.rejects(
    db.pool.query("INSERT INTO finance.journals(id) VALUES($1)", [
      randomUUID(),
    ]),
  );
  await assert.rejects(db.pool.query("UPDATE finance.balances SET units=100"));
  await assert.rejects(db.pool.query("TRUNCATE finance.entries"));
  await assert.rejects(
    db.pool.query(
      "SELECT finance.post_internal($1,$2,$3,'bad','test_fixture','[]'::jsonb,NULL)",
      [randomUUID(), asset, randomUUID()],
    ),
  );
  await assert.rejects(new LedgerService(owner).post(posting()));
});
test("unbalanced, wrong-asset and fractional atomic SQL postings leave no partial state", async () => {
  const j = posting();
  await assert.rejects(
    ledger.post({ ...j, legs: [j.legs[0], { ...j.legs[1], units: "2" }] }),
  );
  const foreign = randomUUID();
  await ledger.createAccount({
    id: foreign,
    assetId: liveAsset,
    ownerId: null,
    purpose: "custody",
    normalSide: "debit",
    nonnegative: true,
  });
  await assert.rejects(
    ledger.post({
      ...j,
      legs: [{ ...j.legs[0], accountId: foreign }, j.legs[1]],
    }),
  );
  await assert.rejects(
    db.pool.query(
      "SELECT finance.post($1,$2,$3,$4,'test_fixture',$5::jsonb,NULL)",
      [
        j.id,
        asset,
        j.operationId,
        j.key,
        JSON.stringify(j.legs.map((v) => ({ ...v, units: "1.5" }))),
      ],
    ),
  );
  assert.equal((await balances()).available, "0");
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.journals")).rows[0]
      .count,
    "0",
  );
});
test("competing holds cannot double spend, and release/consume conserve the remaining liability", async () => {
  await fund();
  const requests = Array.from({ length: 2 }, () => ({
    id: randomUUID(),
    actionId: randomUUID(),
    availableId: available,
    heldId: tradeHeld,
    units: "700000",
  }));
  const results = await Promise.allSettled(
    requests.map((v) => ledger.reserve(v)),
  );
  assert.equal(results.filter((v) => v.status === "fulfilled").length, 1);
  const h = requests[results.findIndex((v) => v.status === "fulfilled")];
  assert.equal((await balances()).available, "300000");
  const action = {
    id: h.id,
    actionId: randomUUID(),
    action: "release" as const,
    units: "200000",
    destinationId: available,
  };
  await ledger.finishHold(action);
  await ledger.finishHold(action);
  await ledger.finishHold({
    id: h.id,
    actionId: randomUUID(),
    action: "consume",
    units: "500000",
    destinationId: custody,
  });
  assert.equal((await balances()).available, "500000");
  assert.equal((await balances()).trade_held, "0");
  await assert.rejects(
    ledger.finishHold({ ...action, actionId: randomUUID() }),
  );
});
test("hold scope and raw held-account posting cannot bypass reservation records", async () => {
  await fund();
  const h = {
    id: randomUUID(),
    actionId: randomUUID(),
    availableId: available,
    heldId: tradeHeld,
    units: "100000",
  };
  await ledger.reserve(h);
  await assert.rejects(ledger.reserve({ ...h, units: "1" }));
  await assert.rejects(
    ledger.post({
      ...posting("100000"),
      legs: [
        { accountId: tradeHeld, side: "debit", units: "100000" },
        { accountId: available, side: "credit", units: "100000" },
      ],
    }),
  );
  await owner.pool.query(
    "UPDATE finance.holds SET external_unknown=true WHERE id=$1",
    [h.id],
  );
  await assert.rejects(
    ledger.finishHold({
      id: h.id,
      actionId: randomUUID(),
      action: "release",
      units: "100000",
      destinationId: available,
    }),
  );
});
test("operation creation atomically binds MFA, identity revision, fee-inclusive hold and immutable intent", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(auth, adapter),
    v = intent(),
    mfa = await grant(v);
  assert.equal(await service.create(session, v, mfa), v.id);
  assert.equal(await service.create(session, v, mfa), v.id);
  assert.equal((await balances()).available, "390000");
  assert.equal((await balances()).withdrawal_held, "610000");
  assert.ok(
    (
      await owner.pool.query("SELECT consumed_at FROM step_ups WHERE id=$1", [
        mfa,
      ])
    ).rows[0].consumed_at,
  );
  await assert.rejects(service.create(session, { ...v, units: "1" }, mfa));
  await assert.rejects(
    ledger.finishHold({
      id: v.id,
      actionId: randomUUID(),
      action: "release",
      units: "1",
      destinationId: available,
    }),
  );
  const stored = (
    await owner.pool.query("SELECT * FROM finance.operations WHERE id=$1", [
      v.id,
    ])
  ).rows[0];
  assert.ok(!stored.intent_payload.includes(address));
});
test("insufficient funds roll back grant consumption, operation, hold and outbox", async () => {
  const service = new FinancialOperations(auth, new FixtureCustody()),
    v = intent(),
    mfa = await grant(v);
  await assert.rejects(service.create(session, v, mfa));
  assert.equal(
    (
      await owner.pool.query("SELECT consumed_at FROM step_ups WHERE id=$1", [
        mfa,
      ])
    ).rows[0].consumed_at,
    null,
  );
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.operations")).rows[0]
      .count,
    "0",
  );
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.outbox")).rows[0]
      .count,
    "0",
  );
});
test("unknown broadcasts recover the same signature and fee-correct settlement exactly once", async () => {
  await fund();
  const adapter = new FixtureCustody();
  adapter.loseBroadcast = true;
  let service = new FinancialOperations(auth, adapter);
  const v = intent();
  await service.create(session, v, await grant(v));
  await service.dispatch();
  assert.equal((await service.status(session, v.id)).state, "unknown");
  await owner.pool.query(
    "UPDATE finance.operations SET run_at=now() WHERE id=$1",
    [v.id],
  );
  service = new FinancialOperations(auth, adapter);
  adapter.finalState = "confirmed";
  await service.dispatch();
  assert.equal((await service.status(session, v.id)).state, "complete");
  assert.equal(adapter.signCalls, 1);
  assert.equal(adapter.broadcasts.size, 1);
  assert.equal((await balances()).withdrawal_held, "0");
  assert.equal(
    (
      await owner.pool.query(
        "SELECT units FROM finance.balances WHERE account_id=$1",
        [custody],
      )
    ).rows[0].units,
    "400000",
  );
  assert.equal(
    (
      await owner.pool.query(
        "SELECT units FROM finance.balances WHERE account_id=$1",
        [feeAccount],
      )
    ).rows[0].units,
    "10000",
  );
  assert.equal(await service.dispatch(), false);
});
test("canonical final failure releases the whole reservation while not-found never does", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(auth, adapter),
    v = intent();
  await service.create(session, v, await grant(v));
  await service.dispatch();
  assert.equal((await balances()).available, "390000");
  adapter.finalState = "failed_final";
  await owner.pool.query(
    "UPDATE finance.operations SET run_at=now() WHERE id=$1",
    [v.id],
  );
  await service.dispatch();
  assert.equal((await balances()).available, "1000000");
  assert.equal((await service.status(session, v.id)).state, "failed");
});
test("signer tampering and changed KYC cannot authorize a new external transfer", async () => {
  await fund();
  const adapter = new FixtureCustody();
  adapter.wrongDestination = true;
  const service = new FinancialOperations(auth, adapter),
    v = intent();
  await service.create(session, v, await grant(v));
  await service.dispatch();
  assert.equal(adapter.broadcasts.size, 0);
  adapter.wrongDestination = false;
  await owner.pool.query(
    "UPDATE identity_attempts SET revision=revision+1 WHERE case_id IN (SELECT id FROM identity_cases WHERE user_id=$1)",
    [customer],
  );
  await owner.pool.query(
    "UPDATE finance.operations SET run_at=now() WHERE id=$1",
    [v.id],
  );
  await service.dispatch();
  assert.equal(adapter.broadcasts.size, 0);
  assert.equal((await service.status(session, v.id)).state, "review");
});
test("default custody and staging deny creation; fixture custody is not loadable as production", async () => {
  await fund();
  const v = intent();
  await assert.rejects(
    new FinancialOperations(auth).create(session, v, await grant(v)),
  );
  const hosted = loadConfig({
    NODE_ENV: "production",
    DEPLOYMENT_STAGE: "staging",
    DATABASE_URL: runtimeUrl.toString(),
    DATA_ENCRYPTION_KEY: key,
    APP_ORIGIN: "https://fixture.test",
    DELIVERY_MODE: "provider",
    SMTP_HOST: "fixture.invalid",
    MAIL_FROM: "fixture@example.test",
  });
  const hostedAuth = new AuthService(db, hosted, new Delivery(db, hosted));
  assert.throws(
    () => new FinancialOperations(hostedAuth, new FixtureCustody()),
  );
  await assert.rejects(
    new FinancialOperations(hostedAuth).create(session, v, await grant(v)),
  );
});
test("authenticated event duplicates and conflicts retain original evidence without ledger credits", async () => {
  const service = new FinancialOperations(auth, new FixtureCustody()),
    raw = Buffer.from(JSON.stringify({ id: "fixture-event" })),
    headers = { "fixture-signature": hash(raw.toString("base64")) };
  await assert.rejects(service.receiveEvent(raw, {}));
  assert.equal(await service.receiveEvent(raw, headers), "queued");
  assert.equal(await service.receiveEvent(raw, headers), "duplicate");
  const changed = Buffer.from(
    JSON.stringify({ id: "fixture-event", changed: true }),
  );
  assert.equal(
    await service.receiveEvent(changed, {
      "fixture-signature": hash(changed.toString("base64")),
    }),
    "conflict",
  );
  const stored = (await owner.pool.query("SELECT * FROM finance.events"))
    .rows[0];
  assert.equal(stored.conflict, true);
  assert.equal(stored.payload_hash, hash(raw.toString("base64")));
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.event_conflicts"))
      .rows[0].count,
    "1",
  );
  assert.equal((await balances()).available, "0");
});
test("outbox leases survive missing wakeups and fence stale acknowledgements", async () => {
  await fund();
  const first = (
    await db.pool.query("SELECT * FROM finance.claim_outbox('sandbox')")
  ).rows[0];
  await owner.pool.query(
    "UPDATE finance.outbox SET lease_until=now()-interval '1 second'",
  );
  const delivered: string[] = [];
  const worker = new LedgerOutboxWorker(db, "sandbox", async (id) => {
    delivered.push(id);
  });
  await worker.dispatch();
  assert.equal(
    (
      await db.pool.query("SELECT finance.ack_outbox($1,$2) AS ok", [
        first.journal_id,
        first.generation,
      ])
    ).rows[0].ok,
    false,
  );
  assert.deepEqual(delivered, [first.journal_id]);
  assert.equal(await worker.dispatch(), false);
});
test("reconciliation detects drift/missing backing; repair rebuilds only the projection", async () => {
  await fund();
  const service = new FinancialOperations(operatorAuth, new FixtureCustody());
  assert.equal((await service.reconcile()).reconciled, true);
  await owner.pool.query(
    "UPDATE finance.balances SET units=units+1 WHERE account_id=$1",
    [available],
  );
  assert.equal((await service.reconcile()).projectionDifferences, 1);
  await assert.rejects(
    ledger.reserve({
      id: randomUUID(),
      actionId: randomUUID(),
      availableId: available,
      heldId: held,
      units: "1",
    }),
  );
  const count = (
    await owner.pool.query("SELECT count(*) FROM finance.journals")
  ).rows[0].count;
  assert.equal(
    (
      await operatorDb.pool.query(
        "SELECT finance.repair_projection($1) AS ok",
        [available],
      )
    ).rows[0].ok,
    true,
  );
  assert.equal((await balances()).available, "1000000");
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.journals")).rows[0]
      .count,
    count,
  );
  assert.equal(
    (
      await operatorDb.pool.query(
        "SELECT finance.reconcile('sandbox','[]'::jsonb,'fixture-proof') AS result",
      )
    ).rows[0].result.reconciled,
    false,
  );
});
test("custody discrepancy pauses reservations until an operator reconciles and explicitly resumes", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(operatorAuth, adapter);
  const positions = adapter.positions.bind(adapter);
  adapter.positions = async () => [
    { accountId: custody, units: "999999", evidenceRef: "fixture-mismatch" },
  ];
  assert.equal((await service.reconcile()).reconciled, false);
  const h = {
    id: randomUUID(),
    actionId: randomUUID(),
    availableId: available,
    heldId: held,
    units: "1",
  };
  await assert.rejects(ledger.reserve(h));
  assert.equal(
    (await ledger.balancesForCustomer(customer, "sandbox"))[0].spending_paused,
    true,
  );
  await assert.rejects(
    db.pool.query("SELECT finance.resume_asset($1,$2)", [asset, randomUUID()]),
  );
  await assert.rejects(
    operatorDb.pool.query(
      "SELECT finance.post($1,$2,$3,'bad','test_fixture','[]',NULL)",
      [randomUUID(), asset, randomUUID()],
    ),
  );
  adapter.positions = positions;
  assert.equal((await service.reconcile()).reconciled, true);
  await assert.rejects(ledger.reserve(h));
  const proof = (
    await owner.pool.query(
      "SELECT id FROM finance.reconciliation_runs WHERE result->>'reconciled'='true' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0].id;
  assert.equal(
    (
      await operatorDb.pool.query("SELECT finance.resume_asset($1,$2) AS ok", [
        asset,
        proof,
      ])
    ).rows[0].ok,
    true,
  );
  await ledger.reserve(h);
});
test("canonical settlement proof is encrypted and app roles cannot repair history", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(auth, adapter),
    v = intent();
  await service.create(session, v, await grant(v));
  adapter.finalState = "confirmed";
  await service.dispatch();
  const proof = (
    await owner.pool.query(
      "SELECT evidence_payload FROM finance.attempts WHERE operation_id=$1 AND state='complete'",
      [v.id],
    )
  ).rows[0].evidence_payload;
  assert.ok(proof);
  assert.equal(proof.includes(address), false);
  assert.equal(proof.includes("fixture-canonical-reference"), false);
  await assert.rejects(
    db.pool.query("SELECT finance.repair_projection($1)", [available]),
  );
  await assert.rejects(
    db.pool.query("SELECT finance.reconcile('sandbox','[]','fixture')"),
  );
});
test("restore recovery mode permits canonical settlement and event replay but cannot sign or broadcast", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(auth, adapter),
    v = intent();
  await service.create(session, v, await grant(v));
  const recovery = new FinancialOperations(auth, adapter, {
    recoveryOnly: true,
  });
  await assert.rejects(recovery.create(session, intent(), randomUUID()));
  await recovery.dispatch();
  assert.equal(adapter.signCalls, 0);
  assert.equal((await service.status(session, v.id)).state, "prepared");
  await owner.pool.query(
    "UPDATE finance.operations SET run_at=now() WHERE id=$1",
    [v.id],
  );
  await service.dispatch();
  const broadcastCalls = adapter.broadcastCalls;
  await owner.pool.query(
    "UPDATE finance.operations SET run_at=now() WHERE id=$1",
    [v.id],
  );
  await recovery.dispatch();
  assert.equal(adapter.broadcastCalls, broadcastCalls);
  assert.equal((await service.status(session, v.id)).state, "unknown");
  adapter.finalState = "confirmed";
  await owner.pool.query(
    "UPDATE finance.operations SET run_at=now() WHERE id=$1",
    [v.id],
  );
  await recovery.dispatch();
  assert.equal((await service.status(session, v.id)).state, "complete");
  assert.equal(adapter.signCalls, 1);
  assert.equal(adapter.broadcastCalls, broadcastCalls);
});
test("linked corrections exactly reverse the original once and preserve journal history", async () => {
  const original = posting();
  await ledger.post(original);
  const correction: JournalInput = {
    ...posting(),
    kind: "correction",
    reversesId: original.id,
    legs: original.legs.map((v) => ({
      ...v,
      side: v.side === "debit" ? "credit" : "debit",
    })),
  };
  await assert.rejects(
    ledger.post({
      ...correction,
      legs: correction.legs.map((v) => ({ ...v, units: "1" })),
    }),
  );
  await ledger.post(correction);
  await ledger.post({ ...correction, id: randomUUID() });
  await assert.rejects(
    ledger.post({ ...correction, id: randomUUID(), key: randomUUID() }),
  );
  assert.equal((await balances()).available, "0");
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.journals")).rows[0]
      .count,
    "2",
  );
});
test("business state and journal/outbox changes roll back together before commit", async () => {
  const j = posting();
  await assert.rejects(
    db.tx(async (c) => {
      await c.query(
        "INSERT INTO audit_events(user_id,action) VALUES($1,'fixture_rollback')",
        [customer],
      );
      await ledger.post(j, c);
      throw new Error("fixture crash before commit");
    }),
  );
  assert.equal((await balances()).available, "0");
  assert.equal(
    (
      await owner.pool.query(
        "SELECT count(*) FROM audit_events WHERE user_id=$1 AND action='fixture_rollback'",
        [customer],
      )
    ).rows[0].count,
    "0",
  );
  assert.equal(
    (await owner.pool.query("SELECT count(*) FROM finance.outbox")).rows[0]
      .count,
    "0",
  );
});
test("customer and environment scopes do not share balances, holds or status", async () => {
  await fund();
  const otherHeld = randomUUID(),
    otherAvailable = randomUUID();
  for (const [id, purpose] of [
    [otherHeld, "trade_held"],
    [otherAvailable, "available"],
  ] as const)
    await ledger.createAccount({
      id,
      assetId: asset,
      ownerId: other,
      purpose,
      normalSide: "credit",
      nonnegative: true,
    });
  await assert.rejects(
    ledger.reserve({
      id: randomUUID(),
      actionId: randomUUID(),
      availableId: available,
      heldId: otherHeld,
      units: "1",
    }),
  );
  assert.equal(
    (await ledger.balancesForCustomer(other, "sandbox")).every(
      (v) => v.units === "0",
    ),
    true,
  );
  assert.deepEqual(await ledger.balancesForCustomer(customer, "live"), []);
  const service = new FinancialOperations(auth, new FixtureCustody()),
    v = intent();
  await service.create(session, v, await grant(v));
  assert.equal(
    (await service.balances(session)).find((v) => v.purpose === "available")
      ?.units,
    "390000",
  );
  const otherSession = randomUUID();
  await owner.pool.query(
    "INSERT INTO sessions(id,user_id,token_hash,mfa_verified,expires_at,user_agent) VALUES($1,$2,$3,true,now()+interval '1 hour','fixture')",
    [randomUUID(), other, hash(otherSession)],
  );
  assert.equal(await service.status(otherSession, v.id), null);
  await assert.rejects(service.balances(undefined));
  await assert.rejects(service.status(undefined, v.id));
});
test("fresh authentication and identity revision are required before contacting custody", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(auth, adapter),
    v = intent();
  await assert.rejects(service.create(undefined, v, await grant(v)));
  assert.equal(adapter.authorizationCalls, 0);
  const mfa = await grant(v);
  await owner.pool.query(
    "UPDATE identity_attempts SET revision=2 WHERE id=$1",
    [v.identityAttemptId],
  );
  await assert.rejects(service.create(session, v, mfa));
  assert.equal(adapter.authorizationCalls, 0);
  await assert.rejects(
    service.create(session, { ...v, identityRevision: "2" }, mfa),
  );
  assert.equal((await balances()).available, "1000000");
  assert.equal(
    (
      await owner.pool.query("SELECT consumed_at FROM step_ups WHERE id=$1", [
        mfa,
      ])
    ).rows[0].consumed_at,
    null,
  );
});
test("stale and released leases cannot mutate or settle an operation", async () => {
  await fund();
  const service = new FinancialOperations(auth, new FixtureCustody()),
    v = intent();
  await service.create(session, v, await grant(v));
  const first = (
    await db.pool.query("SELECT * FROM finance.claim_operation('sandbox')")
  ).rows[0];
  assert.equal(
    (await db.pool.query("SELECT * FROM finance.claim_operation('sandbox')"))
      .rowCount,
    0,
  );
  await owner.pool.query(
    "UPDATE finance.operations SET lease_until=now()-interval '1 second',run_at=now() WHERE id=$1",
    [v.id],
  );
  const second = (
    await db.pool.query("SELECT * FROM finance.claim_operation('sandbox')")
  ).rows[0];
  assert.notEqual(first.generation, second.generation);
  assert.equal(
    (
      await db.pool.query(
        "SELECT finance.update_operation($1,$2,'review') AS ok",
        [v.id, first.generation],
      )
    ).rows[0].ok,
    false,
  );
  await db.pool.query("SELECT finance.defer_operation($1,$2)", [
    v.id,
    second.generation,
  ]);
  assert.equal(
    (
      await db.pool.query(
        "SELECT finance.update_operation($1,$2,'review') AS ok",
        [v.id, second.generation],
      )
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT finance.finish_operation($1,$2,'failed',$3,'fixture-proof') AS ok",
        [v.id, second.generation, available],
      )
    ).rows[0].ok,
    false,
  );
  assert.equal((await balances()).withdrawal_held, "610000");
});
test("concurrent workers prepare one operation and scope changes during policy lookup stop signing", async () => {
  await fund();
  const adapter = new FixtureCustody(),
    service = new FinancialOperations(auth, adapter),
    v = intent();
  await service.create(session, v, await grant(v));
  const results = await Promise.all([service.dispatch(), service.dispatch()]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(adapter.signCalls, 1);
  assert.equal(adapter.broadcasts.size, 1);
  const next = { ...intent(), units: "100000", feeUnits: "0" };
  await service.create(session, next, await grant(next));
  const originalAuthorize = adapter.authorizeIntent.bind(adapter);
  adapter.authorizeIntent = async (v) => {
    await originalAuthorize(v);
    await owner.pool.query("UPDATE users SET restricted=true WHERE id=$1", [
      customer,
    ]);
  };
  await service.dispatch();
  assert.equal(adapter.signCalls, 1);
  assert.equal(
    (
      await owner.pool.query(
        "SELECT state FROM finance.operations WHERE id=$1",
        [next.id],
      )
    ).rows[0].state,
    "review",
  );
});
test("readiness gives counts only and rejects an overprivileged runtime role", async () => {
  const ready = await checkLedgerReadiness(db);
  assert.equal(ready.runtimeRoleProtected, true);
  assert.equal(ready.custodyConfigured, false);
  assert.equal(JSON.stringify(ready).includes(address), false);
  assert.equal(JSON.stringify(ready).includes(customer), false);
  assert.equal((await checkLedgerReadiness(owner)).runtimeRoleProtected, false);
  await owner.pool.query(
    "GRANT UPDATE ON finance.operations TO zetmond_finance_fixture",
  );
  try {
    assert.equal((await checkLedgerReadiness(db)).runtimeRoleProtected, false);
  } finally {
    await owner.pool.query(
      "REVOKE UPDATE ON finance.operations FROM zetmond_finance_fixture",
    );
  }
  await owner.pool.query(
    "GRANT EXECUTE ON FUNCTION finance.post_internal(uuid,uuid,uuid,text,text,jsonb,uuid) TO zetmond_finance_fixture",
  );
  try {
    assert.equal((await checkLedgerReadiness(db)).runtimeRoleProtected, false);
    await assert.rejects(ledger.post(posting()));
  } finally {
    await owner.pool.query(
      "REVOKE EXECUTE ON FUNCTION finance.post_internal(uuid,uuid,uuid,text,text,jsonb,uuid) FROM zetmond_finance_fixture",
    );
  }
});
