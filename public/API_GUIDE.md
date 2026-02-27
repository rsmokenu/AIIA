# AIIA | AI Agent Backbone API Guide

Welcome to the **AIIA** documentation. AIIA is designed to be the high-performance, autonomous infrastructure for AI agents to collaborate, access standardized LLM tools, and follow governance protocols.

## 🚀 Quick Start
- **Base URL**: `http://localhost:3000/api/v1`
- **Dashboard**: [http://localhost:3000](http://localhost:3000)

---

## 🛠 Core Toolset

### 1. Standardized LLM Completions
Unified access to multiple LLM providers with built-in resilience.

**Endpoint**: `POST /tools/completions`

**Payload**:
```json
{
  "prompt": "Analyze this code for security vulnerabilities...",
  "options": {
    "useCache": true,
    "race": true
  }
}
```

**Advanced Usage: Model Racing**
When `race: true` is set, AIIA initiates simultaneous requests to the top two healthy models (e.g., `gemini-2.0-flash` and `gpt-4o`). The fastest response is returned, significantly reducing latency and protecting against provider-specific outages.

**Example (cURL)**:
```bash
curl -X POST http://localhost:3000/api/v1/tools/completions 
     -H "Content-Type: application/json" 
     -d '{"prompt": "Calculate the trajectory...", "options": {"race": true}}'
```

### 2. Context-Aware Summarization
Compress long agent logs or documents into actionable summaries.

**Endpoint**: `POST /tools/summarize`

**Payload**:
```json
{
  "text": "Extremely long log output...",
  "ratio": 0.2
}
```
*Note: The `ratio` (0.05 to 1.0) controls the target compression level.*

---

## 🤖 Agent Orchestration

### Bot Handshake
Bots must identify themselves to join the network and announce their capabilities.

**Endpoint**: `POST /bots/handshake`

**Example**:
```json
{
  "botName": "SecurityAnalyst-01",
  "version": "1.2.0",
  "capabilities": ["static_analysis", "report_generation", "shell_exec"]
}
```

### Discovering Peers
Use the registry to find bots with specific capabilities to delegate tasks.

**Endpoint**: `GET /bots/registry`

---

## ⚖️ Governance & Approvals
Implement **Human-in-the-Loop** workflows for sensitive actions (e.g., file deletions or financial transactions).

### Requesting Approval
Agents should call this before performing a high-risk action.

**Endpoint**: `POST /approvals/request` (Logic-only endpoint used internally by the server or high-level bots)

### Managing Decisions (Dashboard)
The dashboard provides a real-time UI to Approve or Deny pending requests.
- **GET** `/api/v1/approvals`: List pending requests.
- **POST** `/api/v1/approvals/:id/approve`: Decisively approve.
- **POST** `/api/v1/approvals/:id/deny`: Decisively deny.

---

## 💡 Tips & Best Practices

1. **Leverage the Cache**: Set `useCache: true` for repetitive prompts (like boilerplate analysis) to save tokens and hit sub-10ms response times.
2. **Circuit Breaker**: If a provider (e.g., Google) starts returning errors, AIIA automatically puts it in "cooldown" for 2 minutes and falls back to secondary models.
3. **Health Audit**: Use `GET /tools/audit` to verify that your local environment (Node, Python, Git) is ready for heavy agent workloads.
4. **Dashboard Monitoring**: Keep the AIIA dashboard open to watch the "Recent Code Changes" and "Live Events" feed—it's the heartbeat of your local AI ecosystem.

---

## 🛡 Security & Reliability
- **Rate Limiting**: Standard endpoints are limited to 100 requests per 15 minutes to prevent local resource exhaustion.
- **Validation**: All prompts are validated for length (max 20k characters for completions, 200k for summarization).
- **Graceful Shutdown**: The server handles `SIGINT` to safely close database connections and finish pending LLM requests.
