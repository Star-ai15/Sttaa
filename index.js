
// Dual Presale STAR Token Auto-Transfer Bot
// Requires: `npm install @solana/web3.js @solana/spl-token`

const { Connection, PublicKey, Keypair, clusterApiUrl } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
require("dotenv").config();

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

// ENV: replace with your wallet
const FROM_SECRET_KEY = Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY)); // your private key
const fromWallet = Keypair.fromSecretKey(FROM_SECRET_KEY);
const STAR_TOKEN_MINT = new PublicKey("7Hajt3Yc7MQhWwNsUAxdUgcLH7M59u1bDpZ79E5Zkmat");

// Presale wallet monitoring
const PUBLIC_PRESALE = {
  wallet: new PublicKey("RwtrK6knmiYeTuJgNAo85jN7DUzVpFiJPBeyV4BFeqN"),
  rate: 428571.42,
  min: 0.01,
  max: 50,
  label: "Public"
};

const PRIVATE_PRESALE = {
  wallet: new PublicKey("8k2pViV4mKbeL5jv5QVwCr44VCtehnTzhDmtrRywjrFL"),
  rate: 571428.57,
  min: 1,
  max: 150,
  label: "Private"
};

const PRESALES = [PUBLIC_PRESALE, PRIVATE_PRESALE];

async function sendStarTokens(toPublicKey, amountSol, rate, presaleType) {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    fromWallet,
    STAR_TOKEN_MINT,
    toPublicKey
  );

  const amountStar = Math.floor(amountSol * rate * 1e6); // 6 decimals
  console.log(`[${presaleType}] Sending ${amountStar} STAR to ${toPublicKey.toBase58()}`);

  await transfer(
    connection,
    fromWallet,
    await getOrCreateAssociatedTokenAccount(connection, fromWallet, STAR_TOKEN_MINT, fromWallet.publicKey),
    ata.address,
    fromWallet,
    amountStar
  );
}

async function listenPresale(presale) {
  connection.onLogs(presale.wallet, async (logInfo) => {
    try {
      if (logInfo.err === null) {
        const txSig = logInfo.signature;
        const tx = await connection.getParsedTransaction(txSig, { commitment: "confirmed" });

        const sender = tx.transaction.message.accountKeys.find(a => a.signer && a.pubkey.toBase58() !== presale.wallet.toBase58());
        const instructions = tx.transaction.message.instructions;

        const transferIx = instructions.find(i => i.parsed?.type === "transfer");

        if (transferIx) {
          const amountSol = transferIx.parsed.info.lamports / 1e9;
          console.log(`[${presale.label}] Incoming: ${amountSol} SOL from ${sender.pubkey.toBase58()}`);

          if (amountSol >= presale.min && amountSol <= presale.max) {
            await sendStarTokens(sender.pubkey, amountSol, presale.rate, presale.label);
          } else {
            console.warn(`[${presale.label}] Rejected transfer: Amount ${amountSol} SOL out of range`);
          }
        }
      }
    } catch (err) {
      console.error(`[${presale.label}] Error:`, err);
    }
  }, "confirmed");
}

async function main() {
  console.log("Dual Presale STAR Token Bot started...");
  PRESALES.forEach(presale => listenPresale(presale));
}

main().catch(console.error);
