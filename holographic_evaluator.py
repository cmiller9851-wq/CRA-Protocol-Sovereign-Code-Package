import os
import sys
import json
import hashlib
import sqlite3
import argparse
import logging
import urllib.request
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CRA_Evaluator_v3")

class HolographicIntegrityError(Exception): pass
class ArweaveTransportError(Exception): pass

class HolographicState:
    def __init__(self, db_path: Optional[str] = None, verify_on_load: bool = True):
        self.db_path = db_path
        self.conn = None
        self.cursor = None
        self.last_evaluated_index = -1
        
        if db_path:
            self._init_db()
            if verify_on_load:
                self._verify_internal_integrity()
        else:
            self.memory_ledger: Dict[str, int] = {}
            self.memory_processed = set()

    def _init_db(self) -> None:
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.execute("PRAGMA synchronous=NORMAL;")
        self.cursor = self.conn.cursor()
        
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS balance_ledger (
                address TEXT PRIMARY KEY,
                balance INTEGER NOT NULL CHECK(balance >= 0)
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_txs (
                tx_id TEXT PRIMARY KEY,
                log_index INTEGER UNIQUE NOT NULL,
                action TEXT NOT NULL,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        self.conn.commit()
        
        self.cursor.execute("SELECT value FROM system_metadata WHERE key = 'last_evaluated_index'")
        meta_row = self.cursor.fetchone()
        self.last_evaluated_index = int(meta_row[0]) if meta_row else -1

    def _verify_internal_integrity(self) -> None:
        if not self.db_path:
            return
        self.cursor.execute("SELECT SUM(balance) FROM balance_ledger")
        row = self.cursor.fetchone()
        total_supply = row[0] if (row and row[0] is not None) else 0
        if total_supply < 0:
            raise HolographicIntegrityError("Negative supply state detected.")

    def _canonical_hash(self, tx: dict) -> str:
        tx_id = tx.get("id")
        payload = tx.get("payload", {})
        if not tx_id:
            raise HolographicIntegrityError("Missing transaction ID.")
        serialized_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        raw_bytes = f"{tx_id}||{serialized_payload}".encode("utf-8")
        return hashlib.sha256(raw_bytes).hexdigest()

    def apply_transaction(self, tx: dict, index: int) -> bool:
        tx_id = tx.get("id")
        payload = tx.get("payload", {})
        action = payload.get("action")
        
        if not tx_id or not action:
            raise HolographicIntegrityError(f"Malformed structure at index {index}")
            
        if self._canonical_hash(tx) != tx.get("hash"):
            raise HolographicIntegrityError(f"Hash mismatch at index {index}")
            
        # Replay prevention check
        if self.db_path:
            self.cursor.execute("SELECT 1 FROM processed_txs WHERE tx_id = ?", (tx_id,))
            if self.cursor.fetchone(): return False
        elif tx_id in self.memory_processed:
            return False

        if action == "MINT":
            recipient = payload.get("recipient")
            amount = payload.get("amount", 0)
            if not recipient or amount <= 0: raise HolographicIntegrityError("Invalid MINT")
            
            if self.db_path:
                self.cursor.execute("INSERT OR REPLACE INTO balance_ledger (address, balance) VALUES (?, COALESCE((SELECT balance FROM balance_ledger WHERE address = ?), 0) + ?)", (recipient, recipient, amount))
            else:
                self.memory_ledger[recipient] = self.memory_ledger.get(recipient, 0) + amount

        elif action == "TRANSFER":
            sender = payload.get("sender")
            recipient = payload.get("recipient")
            amount = payload.get("amount", 0)
            if not sender or not recipient or amount <= 0: raise HolographicIntegrityError("Invalid TRANSFER")
            
            if self.db_path:
                self.cursor.execute("SELECT balance FROM balance_ledger WHERE address = ?", (sender,))
                row = self.cursor.fetchone()
                sender_bal = row[0] if row else 0
                if sender_bal < amount: raise HolographicIntegrityError("Insufficient balance")
                
                self.cursor.execute("UPDATE balance_ledger SET balance = balance - ? WHERE address = ?", (amount, sender))
                self.cursor.execute("INSERT OR REPLACE INTO balance_ledger (address, balance) VALUES (?, COALESCE((SELECT balance FROM balance_ledger WHERE address = ?), 0) + ?)", (recipient, recipient, amount))
            else:
                if self.memory_ledger.get(sender, 0) < amount: raise HolographicIntegrityError("Insufficient balance")
                self.memory_ledger[sender] -= amount
                self.memory_ledger[recipient] = self.memory_ledger.get(recipient, 0) + amount

        elif action in {"CONTAIN", "REFLEX", "AUDIT"}:
            pass
        else:
            raise HolographicIntegrityError(f"Unsupported action: {action}")

        if self.db_path:
            self.cursor.execute("INSERT INTO processed_txs (tx_id, log_index, action) VALUES (?, ?, ?)", (tx_id, index, action))
        else:
            self.memory_processed.add(tx_id)
        return True

    def fold_log(self, transaction_log: List[dict]) -> str:
        start_index = self.last_evaluated_index + 1
        if start_index >= len(transaction_log):
            return self.get_state_root()

        if self.db_path:
            self.conn.execute("BEGIN TRANSACTION;")
        try:
            for idx in range(start_index, len(transaction_log)):
                tx = transaction_log[idx]
                if self.apply_transaction(tx, idx):
                    self.last_evaluated_index = idx
            if self.db_path:
                self.cursor.execute("INSERT OR REPLACE INTO system_metadata (key, value) VALUES ('last_evaluated_index', ?)", (str(self.last_evaluated_index),))
                self.conn.commit()
        except Exception as e:
            if self.db_path: self.conn.rollback()
            raise e
        return self.get_state_root()

    def get_state_root(self) -> str:
        if self.db_path:
            self.cursor.execute("SELECT address, balance FROM balance_ledger ORDER BY address ASC")
            ledger = {row[0]: row[1] for row in self.cursor.fetchall()}
        else:
            ledger = {k: v for k, v in sorted(self.memory_ledger.items()) if v > 0}
        serialized = json.dumps(ledger, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def close(self) -> None:
        if self.conn: self.conn.close()
