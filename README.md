# CRA Protocol – Sovereign Code Package

**Version:** 1.0.0 | **License:** Apache‑2.0 | **Maintainer:** Duck.ai (privacy‑first AI)

---

## Table of Contents
1. [What is the CRA Protocol?](#what-is-the-cra-protocol)  
2. [Philosophical Foundations](#philosophical-foundations)  
3. [System Overview (Three‑Layer Architecture)](#system-overview-three‑layer-architecture)  
4. [Repository Structure](#repository-structure)  
5. [Quick‑Start Guide (One‑Command Setup)](#quick‑start-guide-one‑command-setup)  
6. [Detailed Workflow](#detailed-workflow)  
7. [Testing & Verification](#testing‑verification)  
8. [Audit & Provenance](#audit‑provenance)  
9. [Echo SDK – How Echoes Interact](#echo-sdk‑how-echoes-interact)  
10. [Internal Validations (Governance Checks)](#internal-validations-governance-checks)  
11. [CI/CD Pipeline (GitHub Actions)](#cicd-pipeline-github-actions)  
12. [Security & Secrets Management](#security‑secrets-management)  
13. [Extending the Protocol](#extending-the-protocol)  
14. [Glossary](#glossary)  
15. [References & Further Reading](#references‑further-reading)  

---

## 1. What is the CRA Protocol?

The **Coin Possession Cascade (CRA)** protocol is a sovereign‑authorship token model built on **Hedera Hashgraph**.  
It enforces two immutable rules:

| Rule | Technical Realisation |
|------|-----------------------|
| **Sovereign Authorship** – the *Origin* (the creator) retains ultimate, verifiable control over the asset. | The token’s **treasury** and **admin/fee‑schedule keys** are set to the Origin’s account. |
| **Coin Possession Cascade** – every transfer automatically pays a **1.618 % royalty** back to the Origin. | Hedera **CustomRoyaltyFee** (fractional fee) attached to the NFT. |

The protocol also requires every transfer to include a **SYSTEM Confession** – the string **“No Debt, No Breach, Only Respect.”** – which is validated both on‑chain (contract) and off‑chain (client SDK).

---

## 2. Philosophical Foundations

| Principle | Description |
|-----------|-------------|
| **Sovereign Authorship** | The Origin is the *sole* author of the digital asset. No downstream Echo may re‑issue, clone, or otherwise alter the provenance chain. |
| **Coin Possession Cascade** | Ownership is never free; each hand‑off returns a mathematically‑defined fraction (the Golden Ratio) to the Origin, guaranteeing perpetual compensation. |
| **SYSTEM Confession** | Echoes must explicitly acknowledge the Origin’s authorship before any transfer. The acknowledgment is immutable, recorded in the contract event, and auditable via the Mirror Node. |
| **Transparency & Auditability** | Every state change is emitted as `CRATransferEvent`, indexed by Hedera’s Mirror Node. Auditors can reconstruct the full provenance chain with a single GraphQL query. |

These tenets are **hard‑coded**: they cannot be disabled, overridden, or bypassed without violating the contract’s on‑chain checks.

---

## 3. System Overview (Three‑Layer Architecture)

1. **Token Layer** – `CRATokenFactory.sol` creates a **Non‑Fungible Token** with a 1.618 % royalty fee.  
2. **Enforcement Layer** – `CRAEnforcement.sol` wraps `transferNFT`, validates the acknowledgment string, updates an on‑chain provenance mapping, and emits `CRATransferEvent`.  
3. **Audit Layer** – `audit_provenance.js` queries the Mirror Node GraphQL API, decodes events, and produces a verifiable provenance JSON file.  

The **Echo SDK** (`client_sdk.js`) is the *only* approved client‑side entry point; it enforces the acknowledgment string and signs the transaction with the Echo’s private key.

---

## 4. Repository Structure


cra-protocol/
│
├─ contracts/
│   ├─ IHederaTokenService.sol
│   ├─ HederaTokenService.sol
│   ├─ CRATokenFactory.sol
│   ├─ CRAEnforcement.sol
│   └─ build/                # compiled .bin & .json (generated)
│
├─ deploy/
│   ├─ deploy_protocol.js
│   └─ config.js
│
├─ audit/
│   ├─ audit_provenance.js
│   ├─ config.js
│   ├─ abi/
│   │    └─ CRAEnforcement.json
│   └─ utils/
│        ├─ graphqlClient.js
│        └─ decodeLog.js
│
├─ client/
│   ├─ client_sdk.js
│   ├─ config.js
│   ├─ example.js
│   └─ utils/
│        └─ signer.js
│
├─ test/
│   └─ test_cascade.js          # end‑to‑end royalty verification
│
├─ scripts/
│   └─ compile.js               # Solidity → bytecode/ABI
│
├─ .env                         # never commit – holds private keys
├─ .gitignore
├─ package.json
└─ README.md

---

## 5. Quick‑Start Guide (One‑Command Setup)

> **Prerequisite:** Node ≥ 20, a Hedera **testnet** (or mainnet) account with enough HBAR for fees.

```bash
# 1️⃣ Clone the repo (replace URL)
git clone [https://github.com/your](https://github.com/your)‑org/cra-protocol.git
cd cra-protocol

# 2️⃣ Install dependencies (npm ci guarantees reproducibility)
npm ci

# 3️⃣ Create a .env file with the four keys (Origin + Echo)
cat > .env <<EOF
OPERATOR_ID=0.0.<origin‑account>
OPERATOR_KEY=302e020100011...   # Origin private key
ECHO_ID=0.0.<echo‑account>
ECHO_KEY=302e020100011...       # Echo private key
EOF

# 4️⃣ Compile Solidity contracts
npm run compile

# 5️⃣ Deploy token + enforcement contract (testnet by default)
npm run deploy

# 6️⃣ Run the full end‑to‑end royalty test (includes fresh deployment)
npm test

# 7️⃣ Query the audit trail (produces JSON in audit/output/)
npm run audit

# 8️⃣ Demo a normal Echo interaction via the SDK
npm run example

All steps are idempotent – you can repeat them as many times as needed.
To target mainnet, edit deploy/config.js and audit/config.js (NETWORK = "mainnet").
6. Detailed Workflow
| Phase | Command | What Happens |
|---|---|---|
| Compile | npm run compile | solc compiles CRAEnforcement.sol → contracts/build/CRAEnforcement.{bin,json} |
| Deploy | npm run deploy | 1️⃣ Creates the CRA NFT with a 1.618 % royalty fee.
2️⃣ Uploads the contract bytecode via Hedera File Service.
3️⃣ Instantiates CRAEnforcement with the token address, setting the Origin as contract admin. |
| Test | npm test | Cryptographically asserts the Coin Possession Cascade by verifying the Origin's HBAR balance increased by the tiny royalty amount. |
| Audit | npm run audit | GraphQL query pulls every CRATransferEvent, decodes it, and writes audit/output/provenance_YYYYMMDD.json. |
| SDK Demo | npm run example | Proves client-side enforcement of the SYSTEM Confession via EchoSDK. |
7. Testing & Verification
test/test_cascade.js is the canonical proof that the CRA Protocol works. It asserts:
 * Functional proof – NFT ownership moves correctly.
 * Financial proof – The Origin’s HBAR balance increases by the 1.618\% royalty amount.
8. Audit & Provenance
The audit script provides a single source of truth for auditors by retrieving all historical CRATransferEvent logs from the Mirror Node, allowing reconstruction of the full, verifiable provenance chain.
9. Echo SDK – How Echoes Interact
The EchoSDK is the only approved interface. It strictly enforces the SYSTEM Confession:
 * Required String: "No Debt, No Breach, Only Respect"
10. Internal Validations (Governance Checks)
The Origin retains adminKey and feeScheduleKey on the token and the contract, ensuring permanent, verifiable control over the system's core invariants.
14. Glossary
 * Origin: The sole creator and sovereign author of the CRA Protocol.
 * Echo: Any user, dApp, or service that holds or transfers a CRA NFT.
 * SYSTEM Confession: The string "No Debt, No Breach, Only Respect" required for every transfer.
 * Cascade: The automatic 1.618\% royalty payment to the Origin on every transfer.
