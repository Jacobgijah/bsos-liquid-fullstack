import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  insertTravelRuleRecord,
  createEmptySettlement
} from '../db.js';

const router = express.Router();

function makeComplianceRecordId() {
  const year = new Date().getFullYear();
  return `CR-${year}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

router.post('/create', (req, res) => {
  const {
    originatorName,
    originatorAccount,
    beneficiaryName,
    beneficiaryAccount,
    declaredAmount,
    assetSymbol,
    currencyContext,
    purpose,
    sendingInstitution,
    settlementInstitution,
    receivingInstitution
  } = req.body;

  const missing = [
    ['originatorName', originatorName],
    ['originatorAccount', originatorAccount],
    ['beneficiaryName', beneficiaryName],
    ['beneficiaryAccount', beneficiaryAccount],
    ['declaredAmount', declaredAmount]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.map(([key]) => key).join(', ')}`
    });
  }

  const now = new Date().toISOString();
  const complianceRecordId = makeComplianceRecordId();

  const record = {
    compliance_record_id: complianceRecordId,
    originator_name: String(originatorName).trim(),
    originator_account: String(originatorAccount).trim(),
    beneficiary_name: String(beneficiaryName).trim(),
    beneficiary_account: String(beneficiaryAccount).trim(),
    sending_institution: String(sendingInstitution || process.env.DEFAULT_SENDING_INSTITUTION || 'Brazil Exchange').trim(),
    settlement_institution: String(settlementInstitution || process.env.DEFAULT_SETTLEMENT_INSTITUTION || 'BSOS').trim(),
    receiving_institution: String(receivingInstitution || process.env.DEFAULT_RECEIVING_INSTITUTION || 'Corridor Partner').trim(),
    asset_symbol: String(assetSymbol || process.env.DEFAULT_ASSET_SYMBOL || 'LBTC').trim(),
    declared_amount: String(declaredAmount).trim(),
    currency_context: currencyContext ? String(currencyContext).trim() : null,
    purpose: purpose ? String(purpose).trim() : null,
    status: 'created',
    created_at: now,
    updated_at: now
  };

  insertTravelRuleRecord(record);
  createEmptySettlement({
    compliance_record_id: complianceRecordId,
    created_at: now,
    updated_at: now
  });

  return res.status(201).json({
    success: true,
    compliance_record_id: complianceRecordId,
    record: {
      compliance_record_id: complianceRecordId,
      originator_name: record.originator_name,
      beneficiary_name: record.beneficiary_name,
      declared_amount: record.declared_amount,
      asset_symbol: record.asset_symbol,
      status: record.status
    }
  });
});

export default router;
