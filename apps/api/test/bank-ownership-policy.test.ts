import { test } from "node:test";
import assert from "node:assert/strict";
import { compareBankOwnerNames } from "../src/verification/bank-ownership-policy";

test("bank holder comparison accepts casing, spacing and canonically equivalent Unicode without proving ownership", () => {
  for (const [identity, owner] of [
    ["Amina Fatou Clearwater", "  AMINA  FATOU CLEARWATER  "],
    ["José Mwangi", "JOSE\u0301 MWANGI"],
    ["Amina Clearwater", "Amina\u00a0Clearwater"],
  ])
    assert.equal(compareBankOwnerNames(identity, owner), "match");
});
test("different, partial, reordered, transliterated, company and control-character names require review", () => {
  for (const [identity, owner] of [
    ["Amina Clearwater", "Other Customer"],
    ["Amina Fatou Clearwater", "Amina Clearwater"],
    ["Amina Clearwater", "Clearwater Amina"],
    ["José Mwangi", "Jose Mwangi"],
    ["Amina Clearwater", "Amina Clearwater Ltd"],
    ["Amina Clearwater", "Amina\u200b Clearwater"],
    ["Amina Clearwater", "Amina\nClearwater"],
    ["Amina O’Neil", "Amina O'Neil"],
    [null, "Amina Clearwater"],
    ["Amina Clearwater", ""],
    ["12345", "12345"],
  ])
    assert.equal(compareBankOwnerNames(identity, owner), "review");
});
