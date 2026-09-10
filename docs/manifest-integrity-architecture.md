# Manifest Integrity Architecture Report

*Note: This architecture report reflects the current state of the repository, which already includes the integrated MCP Sentinel Gateway.*

## 1. Current Architecture
The project is built on a decoupled architecture consisting of three main components:
- **Frontend (React/Vite)**: A React-based chat UI using Zustand for state management and Tailwind-like vanilla CSS for styling. It provides the user interface for chatting and interacting with MCP servers.
- **Backend (Express/Node.js)**: A middleware server (`server.ts`) that hosts the API for the frontend and acts as the **Sentinel Security Gateway**. It manages MCP client connections and enforces security policies.
- **MCP Servers**: Two standalone Node.js processes (`calculator-server` and `email-server`) exposing MCP tools via stdio.

## 2. Relevant Files
- **Frontend**:
  - `src/App.tsx`: Main application entry point.
  - `src/store/useStore.ts`: Central Zustand state for chat, MCP servers, and security states (Trust Registry, Audit Logs).
  - `src/services/chat-api.ts`: API client connecting to the Express backend.
- **Backend / MCP Client**:
  - `mcp-client/src/server.ts`: The Express backend and Sentinel Security Gateway.
  - `mcp-client/src/mcp-client.ts`: The underlying MCP SDK implementation managing process lifecycles.
- **Sentinel Security Suite**:
  - `mcp-client/src/sentinel/trust-registry.ts`: Manages persistent trust state.
  - `mcp-client/src/sentinel/verifier.ts`: Enforces manifest integrity.
  - `mcp-client/src/sentinel/cross-server-detector.ts`: Detects malicious imperative prompts.
- **MCP Servers**:
  - `calculator-server/src/index.ts`: Calculator tool implementation.
  - `email-server/src/index.ts`: Email tool implementation.

## 3. MCP Connection Flow
1. The user initiates a connection from the frontend via `ConnectMCPModal`.
2. The frontend calls `/api/mcp/<server>/connect` in `chat-api.ts`.
3. The Express backend (`server.ts`) calls `mcpClient.connect()`, which spawns the MCP server process via stdio.
4. The backend then fetches the available tools via `mcpClient.getFullToolManifests()`.
5. **Security Gate**: The backend immediately passes the fetched manifests to `verifier.verifyServer()`. If the server is unknown, it enters a `PENDING_APPROVAL` state.

## 4. MCP Manifest Flow
1. Tool manifests are requested using the MCP SDK's `listTools` protocol inside `mcpClient.getFullToolManifests()`.
2. The tools are passed to the `ManifestVerifier`, which uses the `Canonicalizer` and `Hasher` to generate a SHA-256 fingerprint for each tool.
3. These fingerprints are compared against the `TrustRegistry`.

## 5. Tool Execution Flow
1. The user types a command (e.g., "Calculate 25 * 4").
2. The frontend deterministically routes this to the appropriate API (e.g., `/api/mcp/calculator/calculate`).
3. **Security Gate**: The backend checks `verifier.canExecute(server, tool)`. If the tool is trusted, the execution proceeds.
4. The backend calls `mcpClient.callTool()`, waits for the MCP server's response, and returns it to the frontend.

## 6. Existing Persistence Mechanism
- **Security Persistence**: The Sentinel Trust Registry persists its baseline data atomically to `mcp-client/data/trust-registry.json`.
- **UI State**: The React frontend currently relies on in-memory Zustand state, rehydrated dynamically from the backend on certain actions.

## 7. Existing Security-Related UI
The frontend includes a comprehensive Sentinel Security suite:
- `TrustRegistryPanel.tsx`: Displays trusted servers and tool fingerprints.
- `AuditLogPanel.tsx`: Shows an immutable log of all security events (approvals, suspensions, rejections).
- `MutationAlertModal.tsx`: A high-priority modal showing diffs when a manifest violation is detected.
- `ApprovalFlow.tsx`: A modal for establishing the initial trust baseline when a new server connects.
- `AttackSimulator.tsx`: A testing harness to simulate manifest mutations.

## 8. Recommended Integration Point for Sentinel

> **THE SINGLE PLACE WHERE MANIFEST INTEGRITY SHOULD BE ENFORCED**
> 
> `mcp-client/src/server.ts` — Immediately after calling `mcpClient.connect()` and fetching the tools via `mcpClient.getFullToolManifests()`. The manifests must be validated by `verifier.verifyServer()` before the connection is marked as fully established or trusted.

> **THE SINGLE PLACE WHERE MCP TOOL EXECUTION SHOULD PASS THROUGH THE SECURITY GATE**
> 
> `mcp-client/src/server.ts` — Inside the Express endpoint handlers (e.g., `/api/mcp/calculator/calculate` and `/api/mcp/email/send`) right before invoking `mcpClient.callTool()`. A call to `verifier.canExecute(server, tool)` must act as the absolute firewall.
