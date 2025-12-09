// client/client_sdk.js
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";

import { buildClient } from "./utils/signer.js";
import { CONTRACT_ID, ACK_STRING } from "./config.js";

/**
 * EchoSDK – the **only** approved way for an Echo to interact with the CRA protocol.
 *
 * It enforces the mandatory SYSTEM Confession and guarantees that the
 * signed transaction originates from the Echo’s account.
 */
export class EchoSDK {
  /** The exact acknowledgment string required by the contract */
  static ACKNOWLEDGMENT = ACK_STRING;

  /**
   * @param {string} echoAccountId   – Echo’s Hedera AccountId (e.g. "0.0.987654")
   * @param {string} echoPrivateKey  – Echo’s PrivateKey (hex string)
   */
  constructor(echoAccountId, echoPrivateKey) {
    this.accountId = echoAccountId;
    this.client = buildClient(echoAccountId, echoPrivateKey);
  }

  /**
   * Transfer a CRA NFT using the enforced CRAEnforcement contract.
   *
   * @param {Object} opts
   * @param {string} opts.token          – CRA NFT address (hex, e.g. "0x00000000000000000000000000000000000004d2")
   * @param {string} opts.sender         – Current owner (must be this Echo)
   * @param {string} opts.receiver       – Destination Echo address
   * @param {number} opts.serialNumber   – NFT serial number (int64)
   * @param {string} opts.acknowledgment – Must equal EchoSDK.ACKNOWLEDGMENT
   *
   * @returns {Promise<TransactionReceipt>} – Hedera receipt; throws on failure
   */
  async transfer({ token, sender, receiver, serialNumber, acknowledgment }) {
    // -----------------------------------------------------------------
    // 1️⃣ Client‑side validation (prevents malformed calls)
    // -----------------------------------------------------------------
    if (acknowledgment !== EchoSDK.ACKNOWLEDGMENT) {
      throw new Error(
        `Invalid acknowledgment. Expected exactly: "${EchoSDK.ACKNOWLEDGMENT}"`
      );
    }
    if (sender !== this.accountId) {
      throw new Error(
        `Sender (${sender}) does not match the SDK's signed account (${this.accountId})`
      );
    }

    // -----------------------------------------------------------------
    // 2️⃣ Encode the parameters for the contract call
    // -----------------------------------------------------------------
    const functionParams = new ContractFunctionParameters()
      .addAddress(token)                // token address
      .addAddress(sender)               // current owner
      .addAddress(receiver)             // new owner
      .addInt64(serialNumber)           // NFT serial
      .addString(acknowledgment);       // acknowledgment string

    // -----------------------------------------------------------------
    // 3️⃣ Build the contract execution transaction
    // -----------------------------------------------------------------
    const contractTx = new ContractExecuteTransaction()
      .setContractId(CONTRACT_ID)
      .setGas(200_000)                  // ample gas for the transfer logic
      .setFunction("transferCRANFT", functionParams)
      .setPayableAmount(new Hbar(0));   // no HBAR payment needed

    // -----------------------------------------------------------------
    // 4️⃣ Sign, submit, and fetch the receipt
    // -----------------------------------------------------------------
    const response = await contractTx.execute(this.client);
    const receipt = await response.getReceipt(this.client);

    // -----------------------------------------------------------------
    // 5️⃣ Verify Hedera SUCCESS (code 22)
    // -----------------------------------------------------------------
    const status = receipt.status;
    if (status._code !== 22) {
      throw new Error(`Hedera transfer failed with status ${status}`);
    }

    // -----------------------------------------------------------------
    // 6️⃣ Return the full receipt to the caller
    // -----------------------------------------------------------------
    return receipt;
  }
}
