Here is the **Hackathon MVP Edition** of the PRD. This is scoped strictly for a **24-hour build cycle**, focusing on the "Demo Moment" rather than production scalability.

---

# Product Requirement Document (PRD): Bullseye (Hackathon MVP)

**Product Name:** Bullseye
**Hackathon Goal:** A working "Text-to-Trade" Agent for RobinPump.fun.
**Development Time:** 24 Hours

## 1. The "Money Shot" (Demo Goal)
The judges must see this specific flow in under 60 seconds:
1.  User selects a trending token on RobinPump.fun.
2.  User types a prompt: *"Buy if the price dips 5% but volume stays high."*
3.  **Bullseye AI** instantly converts this text into executable code (Python/JS).
4.  The system runs a **"Flash Backtest"** on the last hour of data to show hypothetical profit.
5.  User clicks **"Deploy Agent"**, and the bot starts watching the chain live.

## 2. MVP Scope (The "Slice")

### IN (Must Build)
*   **Token Feed:** Fetch Top 10 tokens from RobinPump (via RPC or API).
*   **Strategy Generator (LLM):** A single LLM call that translates English -> JSON Logic or Python Script.
*   **Backtest-Lite:** A simple script that runs that logic against the last 100 candles.
*   **Paper Trading Execution:** Log "Buy/Sell" signals in the console/UI instead of spending real money (safer/faster for demo).

### OUT (Cut for Speed)
*   Real-wallet integration (unless you have a working boilerplate; otherwise, Paper Trade is safer).
*   Multi-Agent Reinforcement Learning (too slow).
*   Complex Slippage/Gas calculations.
*   User Authentication (use a hardcoded "Demo User").

## 3. Core Features & User Flow

### 3.1. The Dashboard (Single View)
*   **Left Column:** List of Top 5 "Hot" RobinPump tokens (Live Price + 24h Vol).
*   **Center:** The "Agent Command Line" (Chat interface).
*   **Right Column:** "Agent Logs" (Where the strategy execution output appears).

### 3.2. Feature: The Translator (LLM)
*   **Input:** Natural language (e.g., "Ape in if market cap hits $10k").
*   **Process:** Send prompt to OpenAI (GPT-4o-mini) or Anthropic (Claude 3.5 Sonnet).
*   **Output:** Structured JSON object.
    ```json
    {
      "trigger_condition": "market_cap > 10000",
      "action": "BUY",
      "amount_sol": 0.1
    }
    ```

### 3.3. Feature: The "Flash Backtest"
*   Upon generating the strategy, the backend fetches the last 60 minutes of OHLCV (Open, High, Low, Close, Volume) data for that token.
*   It runs the JSON logic against that array.
*   **UI Result:** A green or red badge: *"This strategy would have made +12% in the last hour."* (This validates the AI to the user).

### 3.4. Feature: The Watch Loop
*   Once "Deployed," a simple backend loop runs every 5 seconds (polling).
*   It checks the current on-chain price against the User's Strategy.
*   If `True` -> Trigger a toaster notification: **"🎯 BULLSEYE! Executing Trade..."**

## 4. Technical Stack (Speed Focus)

*   **Frontend:** Next.js + Tailwind (Use `shadcn/ui` for instant professional look).
*   **Backend:** Next.js API Routes (Serverless) OR a simple Python FastAPI server.
*   **AI:** OpenAI API / LangChain (for structured output parsing).
*   **Data Source:**
    *   *Hack:* If RobinPump has no public API, scrape the HTML or find the underlying RPC contract calls in the browser "Network" tab to get price.
    *   *Fallback:* Use a mock generator for the data stream if the real API is blocked/hard to parse.

## 5. Development Timeline (24 Hours)

*   **Hours 0-4: The Data Pipe.**
    *   Get a script running that prints the price of a RobinPump token every 5 seconds.
*   **Hours 4-10: The Brain.**
    *   Build the Prompt-to-JSON prompt engineering.
    *   Build the simple evaluation logic (`if price < target return buy`).
*   **Hours 10-18: The Frontend.**
    *   Connect the UI to the backend. Make it look "Hacker/Cyber" (Dark mode, green terminal fonts).
*   **Hours 18-22: Integration & Polish.**
    *   Ensure the "Flash Backtest" graph renders.
    *   Add "Loading..." spinners to mask LLM latency.
*   **Hours 22-24: The Pitch.**
    *   Record the demo video.
    *   Write the submission text.

## 6. Hackathon Risks & Cheats
*   **Risk:** LLM writes broken code.
    *   *Fix:* Don't let the LLM write code. Ask it to output parameters for a *pre-written* strategy template (e.g., Moving Average Crossover).
*   **Risk:** RobinPump data is hard to get.
    *   *Fix:* Mock the data. For a hackathon, it is acceptable to simulate the data feed *if* the AI logic is the focus. State clearly that it is a "Simulated Feed" in the demo.

## 7. Submission Narrative
"Memecoins are PVP. You can't click faster than a bot. **Bullseye** levels the playing field by letting anyone build an institutional-grade algo strategy using plain English in seconds. We built a text-to-strategy engine specifically tuned for RobinPump's bonding curves."