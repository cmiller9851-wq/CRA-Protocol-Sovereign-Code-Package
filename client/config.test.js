import { expect, test } from "@jest/globals";
import { ACK_STRING, CONTRACT_ID, NETWORK } from "./config.js";

test("uses the configured Hedera test network", () => {
  expect(NETWORK).toBe("testnet");
});

test("uses a syntactically valid Hedera contract ID", () => {
  expect(CONTRACT_ID).toMatch(/^\d+\.\d+\.\d+$/);
});

test("defines a non-empty contract acknowledgement", () => {
  expect(ACK_STRING.trim().length).toBeGreaterThan(0);
});
