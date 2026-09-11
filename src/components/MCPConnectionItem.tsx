import { Server, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { McpServer } from '../types';

export default function MCPConnectionItem({ server }: { server: McpServer }) {
  const { selectedServerId, setSelectedServerId, trustRegistry } = useStore();
  const isSelected = selectedServerId === server.id;

  // Map UI server ID to Sentinel internal server key
  const sentinelId = server.id === 'server-calc' ? 'calculator'
    : server.id === 'server-email' ? 'email'
    : server.id === 'server-calcmcp2' ? 'calculatormcp2'
    : server.id === 'server-docsearch' ? 'documentsearch' : null;

  const serverTrust = sentinelId && trustRegistry?.servers?.[sentinelId];
  const trustStatus = serverTrust?.status;

  return (
    <div
      className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
      style={{
        padding: '7px 10px',
        borderRadius: 'var(--radius-sm)',
        justifyContent: 'space-between',
        cursor: 'pointer'
      }}
      onClick={() => setSelectedServerId(isSelected ? null : server.id)}
    >
      <div className="flex items-center" style={{ gap: '8px', minWidth: 0 }}>
        <Server size={14} style={{ opacity: isSelected ? 0.9 : 0.6, flexShrink: 0 }} />
        <span style={{ fontSize: '0.825rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {server.name}
        </span>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center" style={{ gap: '6px', flexShrink: 0 }}>
        {server.status === 'connected' && trustStatus ? (
          <TrustBadge status={trustStatus} />
        ) : (
          <span className="text-xs text-tertiary" style={{ fontSize: '0.7rem' }}>
            {server.status}
          </span>
        )}
        <span className={`status-dot status-${server.status}`}></span>
      </div>
    </div>
  );
}

function TrustBadge({ status }: { status: string }) {
  switch (status) {
    case 'trusted':
      return (
        <span className="flex items-center text-xs" style={{ gap: '3px', color: 'var(--sentinel-trusted)', fontSize: '0.675rem' }}>
          <ShieldCheck size={11} /> Trusted
        </span>
      );
    case 'suspended':
    case 'mutation_detected':
      return (
        <span className="flex items-center text-xs" style={{ gap: '3px', color: 'var(--sentinel-critical)', fontSize: '0.675rem' }}>
          <ShieldAlert size={11} /> Suspended
        </span>
      );
    case 'pending_approval':
    case 'discovered':
      return (
        <span className="flex items-center text-xs" style={{ gap: '3px', color: 'var(--sentinel-warning)', fontSize: '0.675rem' }}>
          <Shield size={11} /> Review
        </span>
      );
    default:
      return null;
  }
}
