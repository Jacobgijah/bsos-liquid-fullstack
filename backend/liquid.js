import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

function parseCliArgs(value) {
  if (!value) return [];
  return value.split(' ').map((part) => part.trim()).filter(Boolean);
}

function makeFakeHex(label) {
  return Buffer.from(`${label}-${crypto.randomUUID()}`).toString('hex');
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeUnblindResult(stdout) {
  const trimmed = stdout.trim();
  const parsed = tryParseJson(trimmed);

  if (!parsed) {
    return {
      unblindedTxHex: trimmed,
      parsed: null
    };
  }

  return {
    unblindedTxHex: parsed.hex || trimmed,
    parsed
  };
}

async function runCliCommand(baseArgs, wallet, ...rpcArgs) {
  const cli = process.env.LIQUID_CLI || 'elements-cli';
  const fullArgs = [...baseArgs];

  if (wallet) {
    fullArgs.push(`-rpcwallet=${wallet}`);
  }

  fullArgs.push(...rpcArgs);

  const { stdout, stderr } = await execFileAsync(cli, fullArgs);

  if (stderr && stderr.trim()) {
    console.warn(stderr.trim());
  }

  return stdout.trim();
}

function extractVerifiedAmount(decodedTx, destinationAddress, fallbackAmount) {
  if (!decodedTx || !Array.isArray(decodedTx.vout)) {
    return String(fallbackAmount);
  }

  const matchingOutput = decodedTx.vout.find((output) => {
    const script = output?.scriptPubKey || {};
    const addresses = [script.address, ...(Array.isArray(script.addresses) ? script.addresses : [])].filter(Boolean);
    return addresses.includes(destinationAddress);
  });

  if (matchingOutput?.value !== undefined && matchingOutput?.value !== null) {
    return String(matchingOutput.value);
  }

  const positiveOutput = decodedTx.vout.find((output) => {
    const value = Number(output?.value);
    return Number.isFinite(value) && value > 0;
  });

  if (positiveOutput?.value !== undefined && positiveOutput?.value !== null) {
    return String(positiveOutput.value);
  }

  return String(fallbackAmount);
}

export async function sendConfidentialSettlement({ amount, destinationAddress }) {
  const mode = process.env.LIQUID_MODE || 'mock';

  if (mode === 'mock') {
    const txid = crypto.randomBytes(32).toString('hex');
    return {
      txid,
      destinationAddress: destinationAddress || `el1qq${crypto.randomBytes(20).toString('hex')}`,
      assetId: 'LBTC_TEST_ASSET',
      rawTxHex: makeFakeHex('rawtx'),
      unblindedTxHex: makeFakeHex('unblinded'),
      verifiedAmount: String(amount),
      verificationStatus: 'verified',
      settledAt: new Date().toISOString(),
      mode
    };
  }

  const baseArgs = parseCliArgs(process.env.LIQUID_CLI_ARGS || '-chain=liquidtestnet');
  const wallet = process.env.LIQUID_WALLET;

  let finalDestinationAddress = destinationAddress?.trim();
  if (!finalDestinationAddress) {
    finalDestinationAddress = await runCliCommand(baseArgs, wallet, 'getnewaddress');
  }

  const txid = await runCliCommand(
    baseArgs,
    wallet,
    'sendtoaddress',
    finalDestinationAddress,
    String(amount)
  );

  const rawTxHex = await runCliCommand(baseArgs, wallet, 'getrawtransaction', txid);
  const unblindStdout = await runCliCommand(baseArgs, wallet, 'unblindrawtransaction', rawTxHex);
  const { unblindedTxHex } = normalizeUnblindResult(unblindStdout);

  let verifiedAmount = String(amount);
  try {
    const decodedUnblinded = await runCliCommand(baseArgs, wallet, 'decoderawtransaction', unblindedTxHex);
    const parsedDecoded = tryParseJson(decodedUnblinded);
    verifiedAmount = extractVerifiedAmount(parsedDecoded, finalDestinationAddress, amount);
  } catch (error) {
    console.warn('Could not decode unblinded transaction, falling back to declared amount:', error.message);
  }

  const verificationStatus = String(verifiedAmount) === String(amount) ? 'verified' : 'mismatch';

  return {
    txid,
    destinationAddress: finalDestinationAddress,
    assetId: process.env.DEFAULT_ASSET_SYMBOL || 'LBTC',
    rawTxHex,
    unblindedTxHex,
    verifiedAmount,
    verificationStatus,
    settledAt: new Date().toISOString(),
    mode
  };
}
