# Comprehensive Web3 Deployment & Repository Optimization Guide (v2)

This document provides a set of high-fidelity prompts designed for Claude/ChatGPT to prepare, audit, and deploy your Web3 dApp. These prompts are structured to ensure zero-cost hosting and a seamless beta-testing experience.

---

## Part 1: Repository Audit & Pre-Deployment Analysis

Before pushing your code to a public/private GitHub repo, run this prompt to ensure no secrets are leaked and your build is optimized for production.

### Prompt 1: Technical Gap Analysis & Security Audit
> I am preparing to move my Web3 application from a local development environment to a live beta on the **Base Sepolia** testnet. My backend is **Firebase** (Free Tier). 
>
> Please act as a Senior Web3 Engineer. Analyze my repository and provide a "Gap Analysis" report covering:
> 1. **Secret Management:** Identify any hardcoded `apiKey`, `authDomain`, or `contractAddress` values. Generate a suggested `.env.production` and a corresponding `.gitignore`.
> 2. **Provider Logic:** Review my wallet connection logic (e.g., Wagmi, RainbowKit, or Ethers.js). Ensure it is configured to default to **Base Sepolia (Chain ID: 84532)** and includes fallback RPC URLs (like PublicNode or Ankr) to avoid rate-limiting.
> 3. **Firebase Security:** Verify that the Firebase client-side initialization doesn't expose admin privileges. Suggest standard security rules for the Firestore/Realtime Database to prevent unauthorized writes during beta.
> 4. **Build Optimization:** Suggest optimizations for a production build (e.g., tree-shaking, removing `console.log` statements, and minifying assets).
>
> **Goal:** Get this repo ready for a clean GitHub push and a "one-click" deploy.

---

## Part 2: Deployment Strategy Prompts

Use these prompts once your repo is on GitHub. They guide the specific configurations for the top two free hosting providers.

### Prompt 2: Zero-Config Vercel Deployment
> I have pushed my repo to GitHub and want to deploy to **Vercel** using the Hobby Tier (No Credit Card).
> 1. Walk me through the **Import Project** flow.
> 2. For a Web3 app, how should I handle the "Environment Variables" section in Vercel to ensure the frontend can communicate with both Firebase and the Base Sepolia smart contracts?
> 3. How do I set up a **"Staging" environment**? I want a separate URL for testing breaking changes before they hit the main beta URL.
> 4. Provide a `vercel.json` configuration for a Single Page Application (SPA) to prevent "404 Not Found" errors when users refresh a sub-page.

### Prompt 3: Netlify CI/CD & Redirect Configuration
> I want to host this on **Netlify** (Starter Plan). 
> 1. Explain the process of linking my GitHub repo and setting up **Continuous Deployment**.
> 2. My app uses client-side routing. Write a `_redirects` file that I should place in my `/public` folder to ensure all traffic is handled by `index.html`.
> 3. How can I use **Netlify Snippet Injection** to add a "Beta Version" banner or analytics tag without changing my source code?
> 4. What are the build settings (Build Command and Publish Directory) for a standard React/Vite/Next.js project?

---

## Part 3: The "Beta Tester" Onboarding Suite

A successful beta depends on testers being able to actually use the app. This prompt helps you generate the necessary documentation.

### Prompt 4: Tester Setup & Faucet Guide
> Create a comprehensive **README_TESTERS.md** file for my beta users. It must include:
> 1. **Network Setup:** Clear steps to add **Base Sepolia** to MetaMask (Network Name, RPC URL, Chain ID: 84532, Symbol: ETH, Explorer URL).
> 2. **Gas Faucets:** A list of reliable, free faucets where testers can get Base Sepolia ETH (e.g., Coinbase Faucet, QuickNode, or Alchemy).
> 3. **Testing Tasks:** A structured list of features to test (Wallet connection, Smart Contract interaction, Data persistence via Firebase).
> 4. **Feedback Loop:** A template for reporting bugs, including browser version, wallet type, and transaction hash.

---

## Technical Reference: Base Sepolia Network Details
If your AI or your code needs the specific network parameters, here they are:

* **Network Name:** Base Sepolia
* **RPC URL:** `https://sepolia.base.org`
* **Chain ID:** `84532`
* **Currency Symbol:** `ETH`
* **Block Explorer:** `https://sepolia.basescan.org`

---

## Recommended Deployment Workflow
1. **Local:** Run the Audit Prompt -> Fix `.env` and `.gitignore`.
2. **GitHub:** Push code to a new repository.
3. **Host:** Link GitHub to Vercel/Netlify -> Add Env Vars -> Deploy.
4. **Test:** Use the Tester Guide to perform the first transaction.
