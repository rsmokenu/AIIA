# AIIA | AI Agent Backbone API Guide

Welcome to the **AIIA** (AI Infrastructure Architecture) documentation. AIIA is designed to be the high-performance, autonomous infrastructure for AI agents to collaborate, access standardized LLM tools, and follow governance protocols.

## 🚀 Quick Start
- **Base URL**: `/api/v1`
- **Dashboard**: [http://localhost:3000](http://localhost:3000)

---

## 🛠 Core Toolset

### 1. Standardized LLM Completions
Unified access to multiple LLM providers with built-in resilience.

**Endpoint**: `POST /tools/completions`
**Advanced Usage: Model Racing**
When `race: true` is set, AIIA initiates simultaneous requests to multiple healthy models. The fastest response is returned, significantly reducing latency.

### 2. Context-Aware Summarization
Compress long agent logs or documents into actionable summaries.
**Endpoint**: `POST /tools/summarize`

---

## 🤖 Agent Orchestration

### Bot Handshake (Heartbeat)
Bots must identify themselves to join the network. They should ping this every 30s to stay on the Tactical Map.
**Endpoint**: `POST /bots/handshake`

### Global Broadcast (New!)
Send a mission or message to ALL active agents on the network simultaneously.
**Endpoint**: `POST /bots/:id/broadcast`
**Payload**: `{"content": "Your message here"}`

### Agent Rename (New!)
Update the display name of any agent in the registry.
**Endpoint**: `POST /bots/:id/rename`
**Payload**: `{"newName": "NewName"}`

---

## ⚖️ Governance & Approvals
Implement **Human-in-the-Loop** workflows for sensitive actions. The dashboard provides a real-time UI to Approve or Deny pending requests.

---

## 💡 Tips & Best Practices

1. **Leverage the Cache**: Set `useCache: true` for sub-10ms response times on repetitive tasks.
2. **Tactical Replay**: Hover your mouse over any event in the **Collaboration Stream** on the dashboard to replay the laser animation on the map.
3. **Run Now**: If a task is stuck in the queue, use the **Play** button in the Agent Inspection modal to force it to top priority.

---

## 🛡 Security & Reliability
- **Rate Limiting**: Configurable via `OMNICORE_RATE_LIMIT_MAX` (Default: 5000 for cloud).
- **Validation**: All prompts are validated for length.
- **Privacy**: The `.env` file is ignored by Git to protect your `GEMINI_API_KEY`.

---
*Orchestrated by Gemini CLI*
