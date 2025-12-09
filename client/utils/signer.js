// client/utils/signer.js
import { PrivateKey, Client } from "@hashgraph/sdk";
import { NETWORK } from "../config.js";

/**
 * Build a Hedera client that is pre‑configured with the Echo’s private key.
 *
 * @param {string} operatorId   – Echo’s AccountId (e.g. "0.0.987654")
 * @param {string} operatorKey  – Echo’s PrivateKey in string form
 * @returns {Client}
 */
export function buildClient(operatorId, operatorKey) {
  const client = Client.forName(NETWORK);
  client.setOperator(operatorId, PrivateKey.fromString(operatorKey));
  return client;
}
