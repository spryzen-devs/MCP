import { Server, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { McpServer } from '../types';

export default function MCPConnectionItem({ server }: { server: McpServer }) {
  const { selectedServerId, setSelectedServerId, trustRegistry } = useStore();
  const isSelected = selectedServerId === server.id;

  // Map UI server ID to sentinel server ID
  const sentinelId = server.id === 'server-calc' ? 'calculator' : server.id === 'server-email' ? 'email' : null;
  const serverTrust = sentinelId && trustRegistry?.servers?.[sentinelId];
  const trustStatus = serverTrust?.status;

  return (
    <div
      className="flex flex-col"
      style={{
        padding: '12px',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? 'var(--bg-app)' : 'transparent',
        border: '1px solid',
        borderColor: isSelected ? 'var(--border-subtle)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={() => setSelectedServerId(isSelected ? null : server.id)}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            <Server size={16} />
          </div>
          <span className="font-medium text-sm">{server.name}</span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center" style={{ gap: '6px' }}>
          {server.status === 'connected' && trustStatus && (
            <TrustIndicator status={trustStatus} />
          )}
          {server.status !== 'connected' && (
            <span className="text-xs text-tertiary">{server.status}</span>
          )}
          <span className={`status-dot status-${server.status}`}></span>
        </div>
      </div>
    </div>
  );
}

function TrustIndicator({ status }: { status: string }) {
  switch (status) {
    case 'trusted':
      return (
        <div className="flex items-center" style={{ gap: '3px' }}>
          <ShieldCheck size={12} style={{ color: 'var(--status-connected)' }} />
          <span className="text-xs" style={{ color: 'var(--status-connected)' }}>Verified</span>
        </div>
      );
    case 'suspended':
    case 'mutation_detected':
      return (
        <div className="flex items-center" style={{ gap: '3px' }}>
          <ShieldAlert size={12} style={{ color: 'var(--sentinel-warning)' }} />
          <span className="text-xs" style={{ color: 'var(--sentinel-warning)' }}>Integrity Change</span>
        </div>
      );
    case 'pending_approval':
    case 'discovered':
      return (
        <div className="flex items-center" style={{ gap: '3px' }}>
          <Shield size={12} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs text-tertiary">Pending</span>
        </div>
      );
    default:
      return null;
  }
}
