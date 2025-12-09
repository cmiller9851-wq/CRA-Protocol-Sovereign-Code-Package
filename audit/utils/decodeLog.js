// audit/utils/decodeLog.js
import { ethers } from "ethers";
import abi from "../abi/CRAEnforcement.json";

/**
 * Decode a single `CRATransferEvent` log entry.
 *
 * @param {string} data   – Hex‑encoded `data` field from the log
 * @param {Array<string>} topics – Array of topic hashes (topic[0] is the event signature)
 * @returns {object} decoded fields:
 *   { token, sender, receiver, serialNumber, acknowledgment }
 */
export function decodeCRATransferLog(data, topics) {
  const iface = new ethers.utils.Interface(abi);
  const decoded = iface.decodeEventLog(
    "CRATransferEvent",
    data,
    topics
  );

  return {
    token: decoded.token,
    sender: decoded.sender,
    receiver: decoded.receiver,
    serialNumber: decoded.serialNumber.toString(),
    acknowledgment: decoded.acknowledgment
  };
}
