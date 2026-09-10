import { X, Server, Settings, RefreshCw, PowerOff, Loader2, ShieldCheck, ShieldAlert, Shield, Hash } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { McpServer } from '../types';
import { connectCalculator, disconnectCalculator, connectEmail, disconnectEmail, connectCalculatorMCP2, disconnectCalculatorMCP2, connectDocumentSearch, disconnectDocumentSearch } from '../services/chat-api';
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

  // Map to sentinel ID
  const sentinelId = server.id === 'server-calc' ? 'calculator' : server.id === 'server-email' ? 'email' : server.id === 'server-calcmcp2' ? 'calculatormcp2' : server.id === 'server-docsearch' ? 'documentsearch' : null;
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

      updateServerStatus(server.id, 'connected', result?.sentinel?.toolResults ? result.fullManifests : undefined);
      await fetchSentinelStatus();

      // If sentinel returned a verification with pending_approval, show approval flow
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
    <div className="right-panel" style={{ padding: '24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <h3 className="font-medium">MCP Details</h3>
        <button className="btn-icon" onClick={() => setSelectedServerId(null)}>
          <X size={18} />
        </button>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <div className="flex items-center" style={{ gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
            <Server size={20} className="text-secondary" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="font-medium text-lg">{server.name}</h2>
            <div className="flex items-center" style={{ gap: '6px' }}>
              <span className={`status-dot status-${server.status}`}></span>
              <span className="text-xs text-secondary capitalize">{server.status}</span>
            </div>
          </div>
          <div>
            {server.status !== 'connected' ? (
              <button
                className="btn"
                style={{ background: 'var(--text-primary)', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', minHeight: 'auto' }}
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Connect
              </button>
            ) : (
              <button
                className="btn"
                style={{ color: 'var(--status-error)', borderColor: 'rgba(220, 38, 38, 0.2)', padding: '6px 12px', fontSize: '12px', minHeight: 'auto' }}
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />} Disconnect
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-secondary" style={{ lineHeight: 1.5 }}>
          {server.type === 'local'
            ? `Local server running via: ${server.command}`
            : `Remote server connected to: ${server.endpoint}`
          }
        </p>
      </div>

      {/* Security Section */}
      {server.status === 'connected' && serverTrust && (
        <div style={{ marginBottom: '32px' }}>
          <h4 className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '12px', letterSpacing: '0.05em' }}>
            Security Status
          </h4>
          <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <span className="text-sm font-medium">Integrity</span>
              <span className={`sentinel-status-badge sentinel-status-${serverTrust.status}`}>
                {getStatusIcon(serverTrust.status)}
                {serverTrust.status.toUpperCase().replace('_', ' ')}
              </span>
            </div>

            {serverTrust.approvedAt && (
              <div className="text-xs text-tertiary" style={{ marginBottom: '4px' }}>
                Approved: {new Date(serverTrust.approvedAt).toLocaleString()}
              </div>
            )}
            {serverTrust.lastVerified && (
              <div className="text-xs text-tertiary" style={{ marginBottom: '4px' }}>
                Last verified: {new Date(serverTrust.lastVerified).toLocaleString()}
              </div>
            )}

            <div className="flex items-center" style={{ gap: '4px', marginTop: '8px' }}>
              <Hash size={12} className="text-tertiary" />
              <code className="text-xs text-tertiary">Server Fingerprint (SHA-256):<br/>{serverTrust.serverHash ? serverTrust.serverHash.substring(0, 32) + '...' : 'Computing...'}</code>
            </div>

            <details>
              <summary className="text-xs text-tertiary" style={{ marginTop: '8px', cursor: 'pointer', userSelect: 'none' }}>
                View Tool Fingerprints
              </summary>
              <div style={{ marginTop: '4px', paddingLeft: '12px', borderLeft: '1px solid var(--border-subtle)' }}>
                {Object.values(serverTrust.tools).map((tool) => (
                  <div key={tool.toolName} className="flex items-center" style={{ gap: '4px', marginTop: '4px' }}>
                    <Hash size={10} className="text-tertiary" />
                    <code className="text-[10px] text-tertiary">{tool.toolName}: {tool.manifestHash.substring(0, 16)}...</code>
                  </div>
                ))}
              </div>
            </details>

            <button
              className="btn w-full"
              style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px' }}
              onClick={handleReverify}
            >
              <RefreshCw size={12} /> Verify Now
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
        <h4 className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '12px', letterSpacing: '0.05em' }}>
          Available Tools ({server.status === 'connected' ? server.tools.length : 0})
        </h4>

        <div className="flex flex-col" style={{ gap: '12px' }}>
          {server.status === 'connected' ? server.tools.map((tool, idx) => (
            <div key={idx} style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div className="font-medium text-sm" style={{ marginBottom: '4px' }}>{tool.name}</div>
              <div className="text-xs text-secondary" style={{ marginBottom: tool.inputSchema ? '12px' : '0' }}>{tool.description}</div>
              {tool.inputSchema && (
                <div>
                  <div className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '4px', letterSpacing: '0.05em' }}>Input Schema:</div>
                  <pre className="text-xs text-secondary" style={{ background: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )) : (
            <div className="text-sm text-tertiary" style={{ fontStyle: 'italic' }}>
              No tools discovered yet.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
        <div className="flex flex-col" style={{ gap: '8px' }}>
          <button className="btn w-full" style={{ justifyContent: 'flex-start' }}>
            <Settings size={16} className="text-secondary" /> Server Settings
          </button>
        </div>
      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'trusted': return <ShieldCheck size={12} style={{ marginRight: '4px' }} />;
    case 'suspended':
    case 'mutation_detected': return <ShieldAlert size={12} style={{ marginRight: '4px' }} />;
    default: return <Shield size={12} style={{ marginRight: '4px' }} />;
  }
}
