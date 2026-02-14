# Sisyphus: AI Chat + Tempo On-chain Operations

![Sisyphus Banner](https://via.placeholder.com/1200x400?text=Sisyphus+AI+Trading+Agent)

**Sisyphus** is a Next.js web app that lets you use natural language to execute **Tempo** on-chain operations (swaps, limit orders, token deploy/mint, scheduled & recurring payments).

## 🚀 Categories & Tracks

*   **Primary:** Track 3: AI Agents & Automation (Natural Language DeFi)
*   **Secondary:** Track 2: Stablecoin Infrastructure (DEX Integration, Tick-based Limit Orders)
*   **Tertiary:** Track 1: Payments & Social (Recurring Payments, Batch Transfers)

## ✨ Key Features

### 🤖 Natural Language DeFi Interface
Interact with the blockchain using plain English. No need to navigate complex UIs.
*   "Swap 100 AlphaUSD for BetaUSD"
*   "Buy 1000 BetaUSD when price hits 0.99" (Limit Orders)
*   "Deploy a new token called GutsToken"

### 🔄 Automated & Recurring Payments
Leverage Tempo's scheduler to automate your financial life.
*   **Recurring Payments:** "Send 50 USDC to bob.eth every Friday."
*   **Scheduled Transfers:** "Pay Alice 100 USD on March 1st."
*   **Batch Processing:** Upload `.csv` or `.txt` files to execute thousands of payments in a single transaction.

### 📈 Advanced Trading Tools
Direct integration with Tempo's native Orderbook DEX.
*   **Limit Orders:** Place precision orders using Tempo's tick-based system.

### 🔐 Secure & Non-Custodial
*   **Passkey Support:** Biometric authentication for seamless, secure signing.
*   **Self-Custody:** You always retain control of your funds.
*   **Privacy-Focused:** Integration with Privy for secure wallet management.

## 🛠 Tech Stack

*   **Blockchain:** [Tempo (Moderato Testnet)](https://tempo.xyz)
*   **Frontend:** Next.js 15, React 19, MUI, Tailwind CSS
*   **Web3 Integration:** Wagmi v2, Viem, TanStack Query
*   **Auth:** Privy, Passkeys (WebAuthn)
*   **AI/LLM:** OpenAI / Grok Integration for intent recognition

## 🏗 Architecture

Sisyphus interacts with Tempo's unique primitives:
1.  **Tempo native DEX:** For swaps and limit orders.
2.  **Payment Scheduler:** For authorized recurring transfers.
3.  **Cloud Agent/Keeper:** A server-side component that monitors schedules and executes due tasks securely.

## 🚀 Getting Started

### Prerequisites
*   Node.js v20+
*   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <YOUR_REPO_URL>
    cd <REPO_DIR>
    ```

2.  **Install dependencies:**
    ```bash
    cd web
    npm install
    ```

3.  **Configure Environment:**
    Copy `.env.example` to `web/.env.local` and add your keys (GROK_API_KEY, optional Supabase, keeper key for execute-due).

4.  **Run Development Server:**
    ```bash
    cd web
    npm run dev
    ```

## Open source checklist

- Do not commit `.env`, `web/.env.local`, `contracts/.env`, `*.pem`, or `*.key` (they are gitignored by default).

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

---
