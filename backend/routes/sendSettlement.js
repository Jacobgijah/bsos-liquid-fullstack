import express from 'express';
import {
  getTravelRuleRecordByComplianceId,
  updateSettlement,
  updateTransferStatus
} from '../db.js';
import { sendConfidentialSettlement } from '../liquid.js';

const router = express.Router();

router.post('/send', async (req, res, next) => {
  try {
    const { complianceRecordId, destinationAddress } = req.body;

    if (!complianceRecordId) {
      return res.status(400).json({
        success: false,
        error: 'complianceRecordId is required'
      });
    }

    const record = getTravelRuleRecordByComplianceId(String(complianceRecordId).trim());

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Compliance record not found'
      });
    }

    const settlementResult = await sendConfidentialSettlement({
      amount: record.declared_amount,
      destinationAddress: destinationAddress || undefined
    });

    updateSettlement({
      compliance_record_id: record.compliance_record_id,
      liquid_txid: settlementResult.txid,
      destination_address: settlementResult.destinationAddress,
      asset_id: settlementResult.assetId,
      raw_tx_hex: settlementResult.rawTxHex,
      unblinded_tx_hex: settlementResult.unblindedTxHex,
      verified_amount: settlementResult.verifiedAmount,
      verification_status: settlementResult.verificationStatus,
      settled_at: settlementResult.settledAt,
      updated_at: new Date().toISOString()
    });

    updateTransferStatus(record.compliance_record_id, 'settled');

    return res.json({
      success: true,
      compliance_record_id: record.compliance_record_id,
      liquid_txid: settlementResult.txid,
      destination_address: settlementResult.destinationAddress,
      verified_amount: settlementResult.verifiedAmount,
      verification_status: settlementResult.verificationStatus,
      mode: settlementResult.mode
    });
  } catch (error) {
    next(error);
  }
});

export default router;
