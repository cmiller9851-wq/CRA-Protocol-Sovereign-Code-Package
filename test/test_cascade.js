// test/test_cascade.js
// ---------------------------------------------------------------
//  Run with:   npm test
//  Verifies the Coin Possession Cascade (1.618% Royalty)
// ---------------------------------------------------------------

import { expect } from "chai";
import {
  Client,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  CustomRoyaltyFee,
  PrivateKey,
  AccountId,
  FileCreateTransaction,
  ContractCreateTransaction,
  ContractFunctionParameters,
  Hbar,
  TokenAssociateTransaction,
  TokenMintTransaction,
  TokenInfoQuery,
  AccountBalanceQuery,
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import "dotenv/config"; // loads .env into process.env

// ----------------------------------------------------------------
//  Configuration (read from .env)
// ----------------------------------------------------------------
// NOTE: OPERATOR is the ORIGIN / deployer
const ORIGIN_ID   = AccountId.fromString(process.env.OPERATOR_ID);
const ORIGIN_KEY  = PrivateKey.fromString(process.env.OPERATOR_KEY);
const ECHO_ID     = AccountId.fromString(process.env.ECHO_ID);
const ECHO_KEY    = PrivateKey.fromString(process.env.ECHO_KEY);
const NETWORK     = "testnet";

// ----------------------------------------------------------------
//  Helper – build a client for a given operator
// ----------------------------------------------------------------
function clientFor(accountId, privateKey) {
  const client = Client.forName(NETWORK);
  client.setOperator(accountId, privateKey);
  return client;
}

// Helper to resolve paths relative to the current working directory
const resolvePath = (filePath) => path.resolve(process.cwd(), filePath);
const CONTRACT_BYTECODE_FILE = resolvePath('contracts/build/CRAEnforcement.bin');

// ----------------------------------------------------------------
//  Test suite
// ----------------------------------------------------------------
describe("Coin Possession Cascade – 1.618% royalty verification", function () {
  this.timeout(120_000); // Hedera ops can be slow

  // ----------------------------------------------------------------
  //  Shared objects
  // ----------------------------------------------------------------
  let tokenId;
  let contractId;
  const serialNumber = 1;
  const ROYALTY_NUM = 1618;
  const ROYALTY_DEN = 100_000;

  // ----------------------------------------------------------------
  //  1️⃣ Deploy token + contract
  // ----------------------------------------------------------------
  before(async function() {
    console.log('\n--- Test Setup: Deploying fresh protocol instance ---');
    const client = clientFor(ORIGIN_ID, ORIGIN_KEY);

    // ----- 1.1 Create the CRA NFT with royalty fee -----
    const royaltyFee = new CustomRoyaltyFee()
      .setNumerator(ROYALTY_NUM)
      .setDenominator(ROYALTY_DEN)
      .setFeeCollectorAccountId(ORIGIN_ID);

    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName("CRA Test Token")
      .setTokenSymbol("CRAT")
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(ORIGIN_ID)
      .setCustomFees([royaltyFee])
      .setAdminKey(ORIGIN_KEY)
      .setSupplyKey(ORIGIN_KEY)
      .freezeWith(client);

    const tokenCreateResp = await tokenCreateTx.sign(ORIGIN_KEY).execute(client);
    const tokenCreateReceipt = await tokenCreateResp.getReceipt(client);
    tokenId = tokenCreateReceipt.tokenId;
    console.log(`   - Token ID: ${tokenId.toString()}`);

    // ----- 1.2 Mint a single NFT (serial 1) -----
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([Buffer.from("test-CRA-NFT")])
      .freezeWith(client);
    await (await mintTx.sign(ORIGIN_KEY).execute(client)).getReceipt(client);
    console.log(`   - Minted Serial ${serialNumber}`);


    // ----- 1.3 Upload CRAEnforcement bytecode & deploy contract -----
    const bytecode = fs.readFileSync(CONTRACT_BYTECODE_FILE);

    const fileCreateTx = new FileCreateTransaction().setContents(bytecode).setKeys([ORIGIN_KEY]).freezeWith(client);
    const fileCreateResp = await fileCreateTx.sign(ORIGIN_KEY).execute(client);
    const bytecodeFileId = (await fileCreateResp.getReceipt(client)).fileId;

    const constructorParams = new ContractFunctionParameters()
      .addAddressArray([tokenId.toSolidityAddress()]);

    const contractCreateTx = new ContractCreateTransaction()
      .setBytecodeFileId(bytecodeFileId)
      .setGas(3_000_000)
      .setAdminKey(ORIGIN_KEY)
      .setConstructorParameters(constructorParams)
      .freezeWith(client);
    const contractCreateResp = await contractCreateTx.sign(ORIGIN_KEY).execute(client);
    contractId = (await contractCreateResp.getReceipt(client)).contractId;
    console.log(`   - Contract ID: ${contractId.toString()}`);

    // ----- 1.4 Associate the NFT with the Echo account (required before transfer) -----
    const associateTx = new TokenAssociateTransaction()
      .setAccountId(ECHO_ID)
      .setTokenIds([tokenId])
      .freezeWith(clientFor(ECHO_ID, ECHO_KEY));
    await (await associateTx.sign(ECHO_KEY).execute(clientFor(ECHO_ID, ECHO_KEY))).getReceipt(clientFor(ECHO_ID, ECHO_KEY));
    console.log(`   - Echo Account Associated: ${ECHO_ID.toString()}`);
  });

  // ----------------------------------------------------------------
  //  2️⃣ Perform a single transfer from Origin → Echo
  // ----------------------------------------------------------------
  it("should transfer the NFT and verify the Origin receives the royalty HBAR gain", async function() {
    const originClient = clientFor(ORIGIN_ID, ORIGIN_KEY);
    const echoClient   = clientFor(ECHO_ID, ECHO_KEY);

    // ----- 2.1 Record balances before the transfer -----
    const originBalBefore = await new AccountBalanceQuery().setAccountId(ORIGIN_ID).execute(originClient);
    const echoBalBefore = await new AccountBalanceQuery().setAccountId(ECHO_ID).execute(echoClient);

    // ----- 2.2 Call the enforcement contract (transferCRANFT) -----
    const fnParams = new ContractFunctionParameters()
      .addAddress(tokenId.toSolidityAddress())
      .addAddress(ORIGIN_ID.toSolidityAddress())
      .addAddress(ECHO_ID.toSolidityAddress())
      .addInt64(serialNumber)
      .addString("No Debt, No Breach, Only Respect"); // SYSTEM Confession

    const execTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(200_000)
      .setFunction("transferCRANFT", fnParams)
      .freezeWith(originClient);

    const execResp = await execTx.sign(ORIGIN_KEY).execute(originClient);
    const execReceipt = await execResp.getReceipt(originClient);
    expect(execReceipt.status._code).to.equal(22); // SUCCESS

    // ----- 2.3 Record balances after the transfer -----
    const originBalAfter = await new AccountBalanceQuery().setAccountId(ORIGIN_ID).execute(originClient);
    const echoBalAfter = await new AccountBalanceQuery().setAccountId(ECHO_ID).execute(echoClient);

    // ----------------------------------------------------------------
    //  3️⃣ Assertion logic – Royalty Flow and Ownership
    // ----------------------------------------------------------------

    // 3.1 Verify Ownership (Functional Proof)
    const tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(originClient);
    const nftStatus = tokenInfo.nfts[0];
    expect(nftStatus.accountId.toString()).to.equal(ECHO_ID.toString(), "NFT ownership must transfer to the Echo.");

    // 3.2 Verify Royalty Gain (Financial Proof)
    const originDelta = originBalAfter.hbars
      .toTinybars()
      .sub(originBalBefore.hbars.toTinybars());
    
    // The Origin must have gained HBAR from the royalty mechanism.
    expect(originDelta.gt(0)).to.be.true; 

    // The gain must be very small (the network's converted HBAR value of the 1.618% fee).
    // Set a safe upper bound: 1000 tinybars (0.00001 Hbar)
    expect(originDelta.lt(1000)).to.be.true; 

    console.log(`\n   ✅ Royalty Check Passed: Origin gained ${originDelta.toString()} tinybars.`);
    
    // 3.3 Verify Sender Loss (Echo paid for the transaction + royalty)
    const echoDelta = echoBalAfter.hbars
      .toTinybars()
      .sub(echoBalBefore.hbars.toTinybars());
    
    // The Echo's delta must be negative (HBAR spent on transaction fee + tiny royalty deduction).
    expect(echoDelta.lt(0)).to.be.true; 
  });
});
