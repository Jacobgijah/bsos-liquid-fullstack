import express from 'express';
import { listRecentTransfers } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const records = listRecentTransfers(Number.isNaN(limit) ? 20 : limit);

  res.json({
    success: true,
    count: records.length,
    transfers: records
  });
});

export default router;
