# CRA Protocol – Sovereign Code Package  

## What the project does  

The **Sovereign Code Package** gives developers a ready‑to‑use toolbox for building applications that put data ownership and consent in the hands of users.  
It bundles:

* **Cryptographic utilities** – sign, verify, and trace every change to a piece of data.  
* **A policy engine** – users write simple rules (read, write, share) that the engine enforces at runtime.  
* **Reference SDKs** – a Python package (`cra-sov`) and a JavaScript/TypeScript package (`@cra/sovereign`) that expose the same API on both sides.  
* **Sample apps** – a CLI, a tiny web front‑end, and a micro‑service that show the whole flow from policy creation to audit‑trail verification.  

All code is released under the **Apache 2.0** license, so you can use it in open‑source or commercial projects without worry.

---

## Quick start  

### Python  

```bash
pip install cra-sov
```

```python
from cra_sov import PolicyEngine, Crypto, UserContext

policy = PolicyEngine.load("alice_policy.json")
request = UserContext(user_id="alice", action="read", resource="doc-42")
signed = Crypto.sign(request, "keys/alice.pem")

if policy.evaluate(signed):
    print("✅ allowed")
else:
    print("❌ denied")
```

### JavaScript / TypeScript  

```bash
npm install @cra/sovereign
```

```ts
import { PolicyEngine, Crypto, UserContext } from "@cra/sovereign";

const policy = PolicyEngine.load("alice_policy.json");
const ctx = new UserContext("alice", "read", "doc-42");
const signed = Crypto.sign(ctx, "keys/alice_key.pem");

if (policy.evaluate(signed)) {
  console.log("✅ allowed");
} else {
  console.log("❌ denied");
}
```

Both snippets do the same thing: load a user‑defined policy, sign a request, and let the engine decide whether the action is permitted.

---

## Documentation  

* **Getting started** – step‑by‑step installation and first‑run guide.  
* **Policy language** – syntax, examples, and best practices.  
* **API reference** – full description of the Python and JavaScript SDKs.  
* **Architecture overview** – how the components fit together, data flow diagram, and security considerations.  

All docs live in the `docs/` folder and are published at https://cra-protocol.github.io/sovereign-code‑package (GitHub Pages).

---

## Contributing  

We welcome improvements, bug reports, and new plugins.

1. Fork the repo.  
2. Create a branch (`git checkout -b feature/your‑idea`).  
3. Follow the code‑style guidelines (black/ruff for Python, eslint/prettier for JavaScript).  
4. Write tests that keep overall coverage above 80 %.  
5. Open a pull request with a clear description of the change.

See `CONTRIBUTING.md` for the full workflow.

---

## Roadmap (high‑level)

| Milestone | Target | What’s coming |
|-----------|--------|---------------|
| **v1.0** | Q2 2026 | Stable SDKs, full test suite, production‑grade docs |
| **v1.1** | Q4 2026 | Decentralised policy storage (IPFS/DAG) |
| **v2.0** | 2027 | Formal verification of the policy engine, HSM integration examples |

---

## License  

The entire codebase is licensed under the **Apache License 2.0**. See `LICENSE` for the full text.  

---  

*Built to give users control, built for developers who need a trustworthy foundation.*