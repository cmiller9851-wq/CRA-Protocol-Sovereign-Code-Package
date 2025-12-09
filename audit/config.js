// audit/config.js
// Configuration for the Mirror‑Node audit script.
// Do **not** commit any private keys here – the script only needs public data.

export const MIRROR_NODE_URL =
  "https://testnet.mirrornode.hedera.com/api/v1/graphql"; // change to mainnet when needed

export const CONTRACT_ID = "0.0.123456"; // <-- replace with the deployed CRAEnforcement address

// The event signature we are interested in:
//   CRATransferEvent(address token, address sender, address receiver, int64 serialNumber, string acknowledgment)
export const EVENT_SIGNATURE = "CRATransferEvent(address,address,address,int64,string)";

// Pagination size – the Mirror‑Node allows up to 100 records per request.
export const PAGE_SIZE = 100;

// Optional time window (ISO‑8601). Set to null to query from the genesis of the contract.
export const FROM_TIMESTAMP = "2025-01-01T00:00:00Z"; // earliest timestamp you care about
export const TO_TIMESTAMP   = null;                // null → now
