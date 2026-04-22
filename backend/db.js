import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.DB_PATH || './data/compliance.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);
const directory = path.dirname(resolvedPath);

if (!fs.existsSync(directory)) {
  fs.mkdirSync(directory, { recursive: true });
}

export const db = new DatabaseSync(resolvedPath);
db.exec('PRAGMA journal_mode = WAL;');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS travel_rule_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compliance_record_id TEXT NOT NULL UNIQUE,
      originator_name TEXT NOT NULL,
      originator_account TEXT NOT NULL,
      beneficiary_name TEXT NOT NULL,
      beneficiary_account TEXT NOT NULL,
      sending_institution TEXT NOT NULL,
      settlement_institution TEXT NOT NULL,
      receiving_institution TEXT NOT NULL,
      asset_symbol TEXT NOT NULL,
      declared_amount TEXT NOT NULL,
      currency_context TEXT,
      purpose TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compliance_record_id TEXT NOT NULL UNIQUE,
      liquid_txid TEXT,
      destination_address TEXT,
      asset_id TEXT,
      raw_tx_hex TEXT,
      unblinded_tx_hex TEXT,
      verified_amount TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending',
      settled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (compliance_record_id) REFERENCES travel_rule_records (compliance_record_id)
    );
  `);
}

export function insertTravelRuleRecord(record) {
  const stmt = db.prepare(`
    INSERT INTO travel_rule_records (
      compliance_record_id,
      originator_name,
      originator_account,
      beneficiary_name,
      beneficiary_account,
      sending_institution,
      settlement_institution,
      receiving_institution,
      asset_symbol,
      declared_amount,
      currency_context,
      purpose,
      status,
      created_at,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    record.compliance_record_id,
    record.originator_name,
    record.originator_account,
    record.beneficiary_name,
    record.beneficiary_account,
    record.sending_institution,
    record.settlement_institution,
    record.receiving_institution,
    record.asset_symbol,
    record.declared_amount,
    record.currency_context,
    record.purpose,
    record.status,
    record.created_at,
    record.updated_at,
  );
}

export function createEmptySettlement(settlement) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO settlements (
      compliance_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?)
  `);

  stmt.run(
    settlement.compliance_record_id,
    settlement.created_at,
    settlement.updated_at,
  );
}

export function getTravelRuleRecordByComplianceId(complianceRecordId) {
  return db.prepare(`
    SELECT *
    FROM travel_rule_records
    WHERE compliance_record_id = ?
  `).get(complianceRecordId);
}

export function getFullRecordByComplianceId(complianceRecordId) {
  return db.prepare(`
    SELECT
      trr.*,
      s.liquid_txid,
      s.destination_address,
      s.asset_id,
      s.raw_tx_hex,
      s.unblinded_tx_hex,
      s.verified_amount,
      s.verification_status,
      s.settled_at
    FROM travel_rule_records trr
    LEFT JOIN settlements s
      ON s.compliance_record_id = trr.compliance_record_id
    WHERE trr.compliance_record_id = ?
  `).get(complianceRecordId);
}

export function getFullRecordByTxid(txid) {
  return db.prepare(`
    SELECT
      trr.*,
      s.liquid_txid,
      s.destination_address,
      s.asset_id,
      s.raw_tx_hex,
      s.unblinded_tx_hex,
      s.verified_amount,
      s.verification_status,
      s.settled_at
    FROM travel_rule_records trr
    JOIN settlements s
      ON s.compliance_record_id = trr.compliance_record_id
    WHERE s.liquid_txid = ?
  `).get(txid);
}

export function updateSettlement(settlement) {
  const stmt = db.prepare(`
    UPDATE settlements
    SET
      liquid_txid = ?,
      destination_address = ?,
      asset_id = ?,
      raw_tx_hex = ?,
      unblinded_tx_hex = ?,
      verified_amount = ?,
      verification_status = ?,
      settled_at = ?,
      updated_at = ?
    WHERE compliance_record_id = ?
  `);

  stmt.run(
    settlement.liquid_txid,
    settlement.destination_address,
    settlement.asset_id,
    settlement.raw_tx_hex,
    settlement.unblinded_tx_hex,
    settlement.verified_amount,
    settlement.verification_status,
    settlement.settled_at,
    settlement.updated_at,
    settlement.compliance_record_id,
  );
}

export function updateTransferStatus(complianceRecordId, status) {
  db.prepare(`
    UPDATE travel_rule_records
    SET status = ?, updated_at = ?
    WHERE compliance_record_id = ?
  `).run(status, new Date().toISOString(), complianceRecordId);
}

export function listRecentTransfers(limit = 20) {
  return db.prepare(`
    SELECT
      trr.compliance_record_id,
      trr.originator_name,
      trr.beneficiary_name,
      trr.asset_symbol,
      trr.declared_amount,
      trr.status,
      trr.created_at,
      s.liquid_txid,
      s.verification_status
    FROM travel_rule_records trr
    LEFT JOIN settlements s
      ON s.compliance_record_id = trr.compliance_record_id
    ORDER BY trr.id DESC
    LIMIT ?
  `).all(limit);
}
