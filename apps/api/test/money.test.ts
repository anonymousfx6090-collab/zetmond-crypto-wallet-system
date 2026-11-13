import { test } from "node:test";
import assert from "node:assert/strict";
import {
  atomic,
  parseAmount,
  formatAmount,
  roundHalfUp,
  calculatePrincipal,
  maximumAtomicUnits,
} from "../src/money/amount";
import { validTronAddress } from "../src/custody/tron-address";
test("amounts retain exact six/two/eight-place units and values above Number precision", () => {
  assert.equal(parseAmount("0.1", 6) + parseAmount("0.2", 6), 300000n);
  assert.equal(
    formatAmount(parseAmount("9007199254740993.123456", 6), 6),
    "9007199254740993.123456",
  );
  assert.equal(parseAmount("1.05", 2), 105n);
  assert.equal(parseAmount("0.00000001", 8), 1n);
  assert.equal(atomic(maximumAtomicUnits.toString()), maximumAtomicUnits);
  assert.equal(formatAmount(0n, 6), "0.000000");
});
test("noncanonical, fractional SQL units, excess precision and overflow cannot silently round", () => {
  for (const v of [
    1,
    NaN,
    Infinity,
    "-1",
    "+1",
    "1e3",
    "01",
    " 1",
    "1,000",
    "1.",
    "0.0000001",
  ])
    assert.throws(() => parseAmount(v, 6));
  for (const v of [
    "1.0",
    "001",
    "1e3",
    "NaN",
    (maximumAtomicUnits + 1n).toString(),
  ])
    assert.throws(() => atomic(v));
  assert.throws(() => atomic("0", true));
  assert.throws(() => formatAmount(-1n, 6));
});
test("half-up quantizes exact positive rationals once, including odd denominators", () => {
  assert.equal(roundHalfUp(5n, 2n), 3n);
  assert.equal(roundHalfUp(4n, 3n), 1n);
  assert.equal(roundHalfUp(5n, 3n), 2n);
  assert.equal(calculatePrincipal("100", "1300"), "13000000");
  assert.equal(calculatePrincipal("1", "0.005"), "1");
  assert.throws(() => roundHalfUp(1n, 0n));
  assert.throws(() => roundHalfUp(-1n, 2n));
});
test("TRON Base58Check is validated independently from network selection", () => {
  assert.ok(validTronAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"));
  assert.equal(validTronAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwa"), false);
  assert.equal(
    validTronAddress("0x0000000000000000000000000000000000000000"),
    false,
  );
  assert.equal(validTronAddress("T" + "0".repeat(33)), false);
});
