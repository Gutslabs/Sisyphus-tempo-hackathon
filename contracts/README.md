# Payment Scheduler (Tempo)

One-time **scheduled** and **recurring** payments for TIP-20 tokens on Tempo. Built with **OpenZeppelin** (SafeERC20, ReentrancyGuard, Ownable, Pausable).

## Prerequisites

- [Foundry (Tempo fork)](https://docs.tempo.xyz/sdk/foundry): `foundryup -n tempo`
- Tempo testnet RPC and (optional) faucet for gas

## Install dependencies

OpenZeppelin is installed via npm (no git required):

```bash
cd contracts
npm install
```

If you use Foundry’s git-based install instead: from a git repo run  
`forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std` and add remappings for `lib/`.

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy to Tempo Testnet

1. Install Foundry Tempo fork and solc (if `forge build` fails on solc download, run `foundryup -n tempo` or install solc separately).

2. Create a key and fund it (faucet):

   ```bash
   cast wallet new
   cast rpc tempo_fundAddress <YOUR_ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz
   ```

3. Put your burner wallet private key in `.env` (file is gitignored):

   ```bash
   echo 'PRIVATE_KEY=0x...' >> .env
   ```

   Deploy:

   ```bash
   ./deploy.sh
   ```

   To pay gas in pathUSD, add `--fee-token 0x20c0000000000000000000000000000000000000` to the `forge create` line in `deploy.sh`.

## Optional: Deploy BatchTransfer (for 1-tx CSV bulk sends with Privy embedded wallets)

Privy embedded wallets are EOAs and do not support Tempo's native passkey batch call flow.
To send many token transfers in a single on-chain transaction, deploy `BatchTransfer` and set its address in the web app env.

1. Add your key to `contracts/.env` (file is gitignored):

   ```bash
   echo 'PRIVATE_KEY=0x...' >> .env
   ```

2. Deploy:

   ```bash
   ./deploy-batch-transfer.sh
   ```

3. Set in `web/.env.local`:

   ```bash
   NEXT_PUBLIC_BATCH_TRANSFER_ADDRESS=0x...
   ```

Notes:
- The first time you use it, you will be prompted to `approve` each token once (AlphaUSD/BetaUSD/etc).
- After approval, CSV bulk sends become 1 on-chain transaction.

4. Verify on explorer (optional):

   ```bash
   forge verify-contract <DEPLOYED_ADDRESS> src/PaymentScheduler.sol:PaymentScheduler --chain-id 42431
   ```

## Contract behaviour

- **One-time scheduled:** `createScheduled(token, recipient, amount, executeAt)` — pulls tokens from caller into the contract; anyone can call `executeScheduled(id)` after `executeAt` to send tokens to the recipient. Payer can `cancelScheduled(id)` for a refund.
- **Recurring:** `createRecurring(token, recipient, amount, intervalSeconds, endTime)` — no escrow; each run pulls from payer. Anyone (e.g. a keeper) calls `executeRecurring(id)` when `block.timestamp >= nextDueTime`; contract does `transferFrom(payer, recipient, amount)` and advances `nextDueTime`. Payer can `cancelRecurring(id)` to stop future runs.
- **Security:** ReentrancyGuard on state-changing external calls; SafeERC20 for all token moves; Ownable + Pausable for emergency pause.

## Tempo token addresses (testnet)

- pathUSD: `0x20c0000000000000000000000000000000000000`
- AlphaUSD: `0x20c0000000000000000000000000000000000001`
- BetaUSD: `0x20c0000000000000000000000000000000000002`
- ThetaUSD: `0x20c0000000000000000000000000000000000003`
