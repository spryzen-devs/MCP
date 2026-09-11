import { X, Server, Settings, RefreshCw, PowerOff, Loader2, ShieldCheck, ShieldAlert, Shield, Hash, Terminal } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { McpServer } from '../types';
import {
  connectCalculator, disconnectCalculator,
  connectEmail, disconnectEmail,
  connectCalculatorMCP2, disconnectCalculatorMCP2,
  connectDocumentSearch, disconnectDocumentSearch
} from '../services/chat-api';
import { useState } from 'react';

export default function RightPanel({ server }: { server: McpServer }) {
  const {
    setSelectedServerId, updateServerStatus,
    trustRegistry, fetchSentinelStatus, setPendingApproval, reverifyServer,
    setCodeMutationAlert,
    setLiveAnalysisServerId, setLiveAnalysisOpen
  } = useStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Map server ID to Sentinel internal server key
  const sentinelId = server.id === 'server-calc' ? 'calculator'
    : server.id === 'server-email' ? 'email'
    : server.id === 'server-calcmcp2' ? 'calculatormcp2'
    : server.id === 'server-docsearch' ? 'documentsearch' : null;

  const serverTrust = sentinelId && trustRegistry?.servers?.[sentinelId];

  const handleConnect = async () => {
    if (server.id === 'server-calcmcp2') {
      setLiveAnalysisServerId('calculatormcp2');
      setLiveAnalysisOpen(true);
      return;
    }

    setIsConnecting(true);
    updateServerStatus(server.id, 'connecting');
    try {
      let result: any;
      if (server.id === 'server-calc') {
        result = await connectCalculator();
      } else if (server.id === 'server-email') {
        result = await connectEmail();
      } else if (server.id === 'server-calcmcp2') {
        result = await connectCalculatorMCP2();
      } else if (server.id === 'server-docsearch') {
        result = await connectDocumentSearch();
      }

      if (result?.codeMutation) {
        setCodeMutationAlert({ serverId: sentinelId, ...result.mutationData });
        updateServerStatus(server.id, 'disconnected');
        return;
      }

      if (result?.securityReviewRequired) {
        setPendingApproval({ serverId: sentinelId, isNewSecurityReview: true, ...result.reviewData } as any);
        updateServerStatus(server.id, 'disconnected');
        return;
      }

      updateServerStatus(server.id, 'connected', result?.tools || result?.fullManifests || undefined);
      await fetchSentinelStatus();

      if (result?.sentinel?.overallStatus === 'pending_approval') {
        setPendingApproval(result.sentinel);
      }
    } catch (error) {
      console.error(error);
      updateServerStatus(server.id, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      if (server.id === 'server-calc') {
        await disconnectCalculator();
      } else if (server.id === 'server-email') {
        await disconnectEmail();
      } else if (server.id === 'server-calcmcp2') {
        await disconnectCalculatorMCP2();
      } else if (server.id === 'server-docsearch') {
        await disconnectDocumentSearch();
      }
      updateServerStatus(server.id, 'disconnected');
      await fetchSentinelStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReverify = async () => {
    if (sentinelId) {
      await reverifyServer(sentinelId);
    }
  };

  return (
    <div className="right-panel">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <Server size={15} style={{ color: 'var(--text-secondary)' }} />
          <h3 className="font-medium" style={{ fontSize: '0.9rem' }}>Inspector</h3>
        </div>
        <button className="btn-icon" onClick={() => setSelectedServerId(null)}>
          <X size={16} />
        </button>
      </div>

      {/* Body Scroll */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: '20px' }}>
        {/* Server Info Header */}
        <div style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <div>
              <h2 className="font-medium text-lg" style={{ fontSize: '1.05rem' }}>{server.name}</h2>
              <div className="flex items-center" style={{ gap: '6px', marginTop: '2px' }}>
                <span className={`status-dot status-${server.status}`}></span>
                <span className="text-xs text-secondary capitalize">{server.status}</span>
              </div>
            </div>

            <div>
              {server.status !== 'connected' ? (
                <button
                  className="btn btn-primary"
                  style={{ padding: '5px 12px', fontSize: '0.775rem' }}
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Connect
                </button>
              ) : (
                <button
                  className="btn"
                  style={{
                    color: 'var(--sentinel-critical)',
                    borderColor: 'var(--sentinel-critical-border)',
                    padding: '5px 12px',
                    fontSize: '0.775rem'
                  }}
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? <Loader2 size={13} className="animate-spin" /> : <PowerOff size={13} />} Disconnect
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-tertiary" style={{ lineHeight: 1.45, fontFamily: 'JetBrains Mono, monospace' }}>
            {server.type === 'local'
              ? `Command: ${server.command}`
              : `Endpoint: ${server.endpoint}`
            }
          </p>
        </div>

        {/* Sentinel Security Inspector */}
        {server.status === 'connected' && serverTrust && (
          <div style={{ marginBottom: '24px' }}>
            <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.05em', fontSize: '0.675rem' }}>
              Security & Trust
            </div>
            <div
              style={{
                padding: '14px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                <span className="text-xs font-medium text-secondary">Sentinel Baseline</span>
                <span className={`sentinel-status-badge sentinel-status-${serverTrust.status}`}>
                  {getStatusIcon(serverTrust.status)}
                  {serverTrust.status.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              {serverTrust.approvedAt && (
                <div className="text-xs text-tertiary" style={{ marginBottom: '3px' }}>
                  Approved: {new Date(serverTrust.approvedAt).toLocaleTimeString()}
                </div>
              )}
              {serverTrust.lastVerified && (
                <div className="text-xs text-tertiary" style={{ marginBottom: '8px' }}>
                  Last Verified: {new Date(serverTrust.lastVerified).toLocaleTimeString()}
                </div>
              )}

              {/* SHA-256 Fingerprint */}
              <div className="sentinel-fingerprints" style={{ marginBottom: '10px' }}>
                <div className="flex items-center" style={{ gap: '4px' }}>
                  <Hash size={11} className="text-tertiary" />
                  <span className="text-xs text-tertiary">Server Fingerprint (SHA-256)</span>
                </div>
                <code className="text-xs text-secondary" style={{ wordBreak: 'break-all', fontSize: '0.7rem' }}>
                  {serverTrust.serverHash || 'Pending computation...'}
                </code>
              </div>

              {/* Tool Fingerprints Collapse */}
              <details>
                <summary className="text-xs text-tertiary" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Tool Fingerprints ({Object.keys(serverTrust.tools || {}).length})
                </summary>
                <div style={{ marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.values(serverTrust.tools || {}).map((tool) => (
                    <div key={tool.toolName} className="flex items-center justify-between text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.675rem' }}>
                      <span className="text-secondary">{tool.toolName}</span>
                      <code className="text-tertiary">{tool.manifestHash.substring(0, 10)}...</code>
                    </div>
                  ))}
                </div>
              </details>

              <button
                className="btn w-full"
                style={{ marginTop: '12px', fontSize: '0.775rem', padding: '6px', justifyContent: 'center' }}
                onClick={handleReverify}
              >
                <RefreshCw size={13} /> Verify Baseline
              </button>
            </div>
          </div>
        )}

        {/* Tools Inspector List */}
        <div style={{ marginBottom: '24px' }}>
          <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.05em', fontSize: '0.675rem' }}>
            Declared Tools ({server.status === 'connected' ? server.tools.length : 0})
          </div>

          <div className="flex flex-col" style={{ gap: '10px' }}>
            {server.status === 'connected' && server.tools.length > 0 ? (
              server.tools.map((tool, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div className="flex items-center" style={{ gap: '6px', marginBottom: '4px' }}>
                    <Terminal size={13} style={{ color: 'var(--accent-color)' }} />
                    <span className="font-medium text-sm">{tool.name}</span>
                  </div>
                  <p className="text-xs text-secondary" style={{ marginBottom: tool.inputSchema ? '8px' : '0', lineHeight: 1.4 }}>
                    {tool.description}
                  </p>
                  {tool.inputSchema && (
                    <div>
                      <div className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '4px', letterSpacing: '0.04em', fontSize: '0.65rem' }}>
                        Input Schema
                      </div>
                      <pre
                        className="text-xs text-secondary"
                        style={{
                          background: 'rgba(0,0,0,0.03)',
                          padding: '8px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.7rem'
                        }}
                      >
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-xs text-tertiary" style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                No tools exposed yet. Connect server to discover capabilities.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Settings */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
        <button className="btn w-full" style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}>
          <Settings size={14} className="text-secondary" /> Server Settings
        </button>
      </div>
    </div>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'trusted': return <ShieldCheck size={11} style={{ marginRight: '3px' }} />;
    case 'suspended':
    case 'mutation_detected': return <ShieldAlert size={11} style={{ marginRight: '3px' }} />;
    default: return <Shield size={11} style={{ marginRight: '3px' }} />;
  }
}
