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
      <div className="modal-content" style={{ maxWidth: '580px', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-trust">
              <Shield size={16} />
            </div>
            <div>
              <h2 className="font-medium text-lg" style={{ fontSize: '1.05rem' }}>Trust Registry</h2>
              <p className="text-xs text-tertiary">Verified baseline specifications for MCP servers</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setTrustPanelOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Server List */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
          {Object.keys(servers).length === 0 ? (
            <div className="text-xs text-tertiary" style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              No MCP servers registered in trust registry. Connect a server to establish a baseline.
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '8px' }}>
              {Object.values(servers).map((server: ServerRegistryEntry) => (
                <div
                  key={server.serverId}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{ cursor: 'pointer', padding: '12px 16px' }}
                    onClick={() => setExpandedServer(expandedServer === server.serverId ? null : server.serverId)}
                  >
                    <div className="flex items-center" style={{ gap: '10px' }}>
                      {getStatusIcon(server.status)}
                      <div>
                        <div className="font-medium text-xs text-primary">{server.serverName}</div>
                        <div className="text-xs text-tertiary" style={{ fontSize: '0.7rem' }}>
                          {Object.keys(server.tools).length} tools · {server.lastVerified ? `Verified ${formatTimeAgo(server.lastVerified)}` : 'Unverified'}
                        </div>
                      </div>
                    </div>

                    <span className={`sentinel-status-badge sentinel-status-${server.status}`}>
                      {server.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>

                  {/* Expanded Details */}
                  {expandedServer === server.serverId && (
                    <div style={{ padding: '0 16px 14px 16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.01)' }}>

                      {/* Server Metadata Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '12px' }}>
                        <MetaItem icon={<Clock size={11} />} label="Approved" value={server.approvedAt ? formatDate(server.approvedAt) : '—'} />
                        <MetaItem icon={<Clock size={11} />} label="Last Verified" value={server.lastVerified ? formatDate(server.lastVerified) : '—'} />
                        <MetaItem icon={<RefreshCw size={11} />} label="Approved Updates" value={String(server.approvedUpdateCount)} />
                        {server.lastMutation && (
                          <MetaItem icon={<ShieldAlert size={11} />} label="Last Mutation" value={formatDate(server.lastMutation)} />
                        )}
                      </div>

                      {/* Registered Tools */}
                      <div style={{ marginTop: '12px' }}>
                        <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.04em', fontSize: '0.65rem' }}>
                          Tool Fingerprints
                        </div>
                        <div className="flex flex-col" style={{ gap: '4px' }}>
                          {Object.values(server.tools).map((tool) => (
                            <div key={tool.toolName} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-primary">{tool.toolName}</span>
                                <div className="flex items-center" style={{ gap: '4px' }}>
                                  <Hash size={10} className="text-tertiary" />
                                  <code className="text-xs text-tertiary" style={{ fontSize: '0.675rem' }}>{tool.manifestHash.substring(0, 14)}...</code>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        className="btn w-full"
                        style={{ marginTop: '12px', fontSize: '0.775rem', justifyContent: 'center' }}
                        onClick={() => reverifyServer(server.serverId)}
                      >
                        <RefreshCw size={13} /> Verify Baseline
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
    <div style={{ padding: '6px 8px', background: 'var(--bg-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center" style={{ gap: '4px', marginBottom: '2px' }}>
        <span className="text-tertiary">{icon}</span>
        <span className="text-tertiary" style={{ fontSize: '0.65rem' }}>{label}</span>
      </div>
      <div className="text-xs font-medium text-primary" style={{ fontSize: '0.75rem' }}>{value}</div>
    </div>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'trusted':
      return <ShieldCheck size={16} style={{ color: 'var(--sentinel-trusted)' }} />;
    case 'suspended':
    case 'mutation_detected':
      return <ShieldAlert size={16} style={{ color: 'var(--sentinel-critical)' }} />;
    default:
      return <Shield size={16} style={{ color: 'var(--sentinel-warning)' }} />;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
