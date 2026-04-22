import express from 'express';
import {
  getFullRecordByComplianceId,
  getFullRecordByTxid
} from '../db.js';

const router = express.Router();

router.get('/:value', (req, res) => {
  const value = String(req.params.value || '').trim();
  const byComplianceId = getFullRecordByComplianceId(value);
  const record = byComplianceId || getFullRecordByTxid(value);

  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'No matching compliance record or txid found'
    });
  }

  const verificationMatch =
    record.verified_amount !== null &&
    record.verified_amount !== undefined &&
    String(record.verified_amount) === String(record.declared_amount);

  return res.json({
    success: true,
    audit: {
      compliance_record_id: record.compliance_record_id,
      liquid_txid: record.liquid_txid,
      status: record.status,
      originator: {
        name: record.originator_name,
        account: record.originator_account
      },
      beneficiary: {
        name: record.beneficiary_name,
        account: record.beneficiary_account
      },
      institutions: {
        sender: record.sending_institution,
        settlement: record.settlement_institution,
        receiver: record.receiving_institution
      },
      asset_symbol: record.asset_symbol,
      declared_amount: record.declared_amount,
      verified_amount: record.verified_amount,
      verification_status: record.verification_status,
      amount_match: verificationMatch,
      destination_address: record.destination_address,
      settled_at: record.settled_at,
      raw_tx_hex: record.raw_tx_hex,
      unblinded_tx_hex: record.unblinded_tx_hex
    }
  });
});

export default router;
