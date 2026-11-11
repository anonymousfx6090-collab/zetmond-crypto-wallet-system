import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryFailure, deliveryFailureCode } from "../src/delivery/failure";

test("delivery diagnostics distinguish known failures without exposing provider details", () => {
  for (const [code, category] of [
    ["EAUTH", "smtp_authentication"],
    ["ETIMEDOUT", "smtp_timeout"],
    ["ECONNECTION", "smtp_connection"],
    ["EDNS", "smtp_connection"],
    ["ECONNRESET", "smtp_connection"],
    ["ESOCKET", "smtp_connection"],
    ["ETLS", "smtp_tls"],
    ["EENVELOPE", "smtp_envelope"],
    ["EMESSAGE", "smtp_message"],
    ["private-password", "delivery_unknown"],
  ]) {
    const result = deliveryFailure({
      code,
      message: "private-password",
      response: "private-password",
    });
    assert.ok(result.startsWith(category));
    assert.ok(!result.includes("private-password"));
    assert.equal(deliveryFailureCode({ code }), category);
  }
  assert.ok(deliveryFailure(null).startsWith("delivery_unknown"));
});
