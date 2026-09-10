const API_BASE = 'http://localhost:3001/api';
const MCP_BASE = `${API_BASE}/mcp`;
const SENTINEL_BASE = `${API_BASE}/sentinel`;

// ─── Existing MCP API ───────────────────────────────────────────

export async function getCalculatorStatus() {
  const response = await fetch(`${MCP_BASE}/status`);
  if (!response.ok) throw new Error('Failed to fetch status');
  return response.json();
}

export async function connectCalculator() {
  const response = await fetch(`${MCP_BASE}/calculator/connect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to connect to Calculator MCP');
  return response.json();
}

export async function disconnectCalculator() {
  const response = await fetch(`${MCP_BASE}/calculator/disconnect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect from Calculator MCP');
  return response.json();
}

export async function connectEmail() {
  const response = await fetch(`${MCP_BASE}/email/connect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to connect to Email MCP');
  return response.json();
}

export async function disconnectEmail() {
  const response = await fetch(`${MCP_BASE}/email/disconnect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect from Email MCP');
  return response.json();
}

export async function connectCalculatorMCP2() {
  const response = await fetch(`${MCP_BASE}/calculatormcp2/connect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to connect to CalculatorMCP2 MCP');
  return response.json();
}

export async function disconnectCalculatorMCP2() {
  const response = await fetch(`${MCP_BASE}/calculatormcp2/disconnect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect from CalculatorMCP2 MCP');
  return response.json();
}

export async function connectDocumentSearch() {
  const response = await fetch(`${MCP_BASE}/documentsearch/connect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to connect to Document Search MCP');
  return response.json();
}

export async function disconnectDocumentSearch() {
  const response = await fetch(`${MCP_BASE}/documentsearch/disconnect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect from Document Search MCP');
  return response.json();
}

export async function calculateExpression(expression: string) {
  const response = await fetch(`${MCP_BASE}/calculator/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression })
  });

  const data = await response.json();
  if (!response.ok && !data.sentinelStatus) {
    throw new Error(data?.error || 'Failed to communicate with Calculator Backend');
  }

  return data;
}

export async function searchDocuments(query: string) {
  const response = await fetch(`${MCP_BASE}/documentsearch/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return response.json();
}

export async function sendMockEmail(to: string, subject: string, body: string) {
  const response = await fetch(`${MCP_BASE}/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body })
  });

  const data = await response.json();
  if (!response.ok && !data.sentinelStatus) {
    throw new Error(data?.error || 'Failed to communicate with Email Backend');
  }

  return data;
}

export async function readMockEmails() {
  const response = await fetch(`${MCP_BASE}/email/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok && !data.sentinelStatus) {
    throw new Error(data?.error || 'Failed to communicate with Email Backend');
  }

  return data;
}

// ─── Sentinel API ───────────────────────────────────────────────

export async function getSentinelStatus() {
  const response = await fetch(`${SENTINEL_BASE}/status`);
  if (!response.ok) throw new Error('Failed to fetch sentinel status');
  return response.json();
}

export async function approveServer(serverId: string) {
  const response = await fetch(`${SENTINEL_BASE}/server/${serverId}/approve`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to approve server');
  return response.json();
}

export async function approveToolUpdate(serverId: string, toolName: string) {
  const response = await fetch(`${SENTINEL_BASE}/server/${serverId}/tool/${encodeURIComponent(toolName)}/approve`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to approve tool update');
  return response.json();
}

export async function rejectToolUpdate(serverId: string, toolName: string) {
  const response = await fetch(`${SENTINEL_BASE}/server/${serverId}/tool/${encodeURIComponent(toolName)}/reject`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to reject tool update');
  return response.json();
}

export async function reverifyServer(serverId: string) {
  const response = await fetch(`${SENTINEL_BASE}/server/${serverId}/reverify`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to re-verify server');
  return response.json();
}

export async function getAuditLog() {
  const response = await fetch(`${SENTINEL_BASE}/audit-log`);
  if (!response.ok) throw new Error('Failed to fetch audit log');
  return response.json();
}

export async function getScenarios() {
  const response = await fetch(`${SENTINEL_BASE}/scenarios`);
  if (!response.ok) throw new Error('Failed to fetch scenarios');
  return response.json();
}

export async function simulateAttack(scenarioId: string) {
  const response = await fetch(`${SENTINEL_BASE}/simulate/${scenarioId}`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to simulate attack');
  return response.json();
}

export async function resetSimulation() {
  const response = await fetch(`${SENTINEL_BASE}/simulate/reset`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to reset simulation');
  return response.json();
}
