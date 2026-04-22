import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase } from './db.js';
import createTransferRouter from './routes/createTransfer.js';
import sendSettlementRouter from './routes/sendSettlement.js';
import auditLookupRouter from './routes/auditLookup.js';
import listTransfersRouter from './routes/listTransfers.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../frontend');

initializeDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDir));

const healthHandler = (_req, res) => {
  res.json({
    success: true,
    service: 'bsos-liquid-backend',
    network: process.env.LIQUID_NETWORK || 'liquidtestnet',
    mode: process.env.LIQUID_MODE || 'mock'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/api/config', (_req, res) => {
  res.json({
    success: true,
    appName: 'BSOS Liquid Settlement Demo',
    mode: process.env.LIQUID_MODE || 'mock',
    network: process.env.LIQUID_NETWORK || 'liquidtestnet',
    defaults: {
      sendingInstitution: process.env.DEFAULT_SENDING_INSTITUTION || 'Brazil Exchange',
      settlementInstitution: process.env.DEFAULT_SETTLEMENT_INSTITUTION || 'BSOS',
      receivingInstitution: process.env.DEFAULT_RECEIVING_INSTITUTION || 'Corridor Partner',
      assetSymbol: process.env.DEFAULT_ASSET_SYMBOL || 'LBTC'
    }
  });
});

app.use('/api/transfers', createTransferRouter);
app.use('/api/transfers', listTransfersRouter);
app.use('/api/settlement', sendSettlementRouter);
app.use('/api/audit', auditLookupRouter);

app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err?.message || 'Unknown error'
  });
});

app.listen(PORT, () => {
  console.log(`BSOS Liquid backend listening on http://localhost:${PORT}`);
});
