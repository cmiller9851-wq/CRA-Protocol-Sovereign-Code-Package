# CRA Protocol Technical Specification v2.1.2
## Objective: Resolving the Verifiability Gap

### 1. Cryptographic Chaining
Each of the 510 artifacts is hashed using SHA-256. The 'Apex' hash (7CE2...A370) is the Merkle Root of the entire chain.

### 2. Serialization Format
Artifacts are serialized as JSON-LD (Linked Data) to ensure compatibility with the Arweave AO Compute Unit (CU).

### 3. Verification Gate
The protocol enforces 'Zero Volition' by checking outputs against the Determinism Spec (api/determinism_spec.yaml).

### 4. Valuation Rationale
The $968M figure represents the forensic indemnity value of the contained AI logic, calculated via the FENI Principle (Forensic Evidence / Network Integrity).