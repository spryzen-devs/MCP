import { X, ShieldCheck, ShieldAlert, Shield, Clock, Hash, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';
import type { ServerRegistryEntry } from '../types';

export default function TrustRegistryPanel() {
  const {
    isTrustPanelOpen, setTrustPanelOpen,
    trustRegistry, fetchSentinelStatus, reverifyServer
  } = useStore();
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  useEffect(() => {
    if (isTrustPanelOpen) {
      fetchSentinelStatus();
    }
  }, [isTrustPanelOpen]);

  if (!isTrustPanelOpen) return null;

  const servers = trustRegistry?.servers || {};

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTrustPanelOpen(false); }}>
      <div className="modal-content" style={{ maxWidth: '580px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-trust">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="font-medium text-lg">MCP Trust Registry</h2>
              <p className="text-xs text-tertiary">Manifest integrity status for all connected servers</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setTrustPanelOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Server List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {Object.keys(servers).length === 0 ? (
            <div className="text-sm text-tertiary" style={{ textAlign: 'center', padding: '32px' }}>
              No servers registered yet. Connect an MCP server to begin.
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '8px' }}>
              {Object.values(servers).map((server: ServerRegistryEntry) => (
                <div key={server.serverId} className="sentinel-server-card">
                  <div
                    className="flex items-center justify-between"
                    style={{ cursor: 'pointer', padding: '14px 16px' }}
                    onClick={() => setExpandedServer(expandedServer === server.serverId ? null : server.serverId)}
                  >
                    <div className="flex items-center" style={{ gap: '10px' }}>
                      {getStatusIcon(server.status)}
                      <div>
                        <div className="font-medium text-sm">{server.serverName}</div>
                        <div className="text-xs text-tertiary">{Object.keys(server.tools).length} tools registered</div>
                      </div>
                    </div>
                    <span className={`sentinel-status-badge sentinel-status-${server.status}`}>
                      {server.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>

                  {/* Expanded Details */}
                  {expandedServer === server.serverId && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-subtle)' }}>

                      {/* Server Metadata */}
                      <div className="sentinel-meta-grid" style={{ marginTop: '12px' }}>
                        <MetaItem icon={<Clock size={12} />} label="Approved" value={server.approvedAt ? formatDate(server.approvedAt) : '—'} />
                        <MetaItem icon={<Clock size={12} />} label="Last Verified" value={server.lastVerified ? formatDate(server.lastVerified) : '—'} />
                        <MetaItem icon={<RefreshCw size={12} />} label="Updates Approved" value={String(server.approvedUpdateCount)} />
                        {server.lastMutation && (
                          <MetaItem icon={<ShieldAlert size={12} />} label="Last Mutation" value={formatDate(server.lastMutation)} />
                        )}
                      </div>

                      {/* Tools */}
                      <div style={{ marginTop: '12px' }}>
                        <div className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '8px', letterSpacing: '0.05em' }}>
                          Registered Tools
                        </div>
                        <div className="flex flex-col" style={{ gap: '6px' }}>
                          {Object.values(server.tools).map((tool) => (
                            <div key={tool.toolName} className="sentinel-tool-item">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{tool.toolName}</span>
                                <div className="flex items-center" style={{ gap: '6px' }}>
                                  <Hash size={10} className="text-tertiary" />
                                  <code className="text-xs text-tertiary">{tool.manifestHash.substring(0, 12)}...</code>
                                </div>
                              </div>
                              <div className="text-xs text-tertiary" style={{ marginTop: '2px' }}>
                                Approved {formatDate(tool.approvedAt)} by {tool.approvedBy}
                                {tool.previousHashes.length > 0 && (
                                  <span> · {tool.previousHashes.length} previous version(s)</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Verify Button */}
                      <button
                        className="btn w-full"
                        style={{ marginTop: '12px' }}
                        onClick={() => reverifyServer(server.serverId)}
                      >
                        <RefreshCw size={14} /> Re-verify Manifests
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="sentinel-meta-item">
      <div className="flex items-center" style={{ gap: '4px' }}>
        <span className="text-tertiary">{icon}</span>
        <span className="text-xs text-tertiary">{label}</span>
      </div>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'trusted':
      return <ShieldCheck size={18} style={{ color: 'var(--status-connected)' }} />;
    case 'suspended':
    case 'mutation_detected':
      return <ShieldAlert size={18} style={{ color: 'var(--sentinel-warning)' }} />;
    default:
      return <Shield size={18} style={{ color: 'var(--text-tertiary)' }} />;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
