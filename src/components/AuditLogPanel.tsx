import { X, Clock, ShieldAlert, ShieldCheck, Shield, AlertTriangle, Play, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect } from 'react';

export default function AuditLogPanel() {
  const { isAuditPanelOpen, setAuditPanelOpen, auditLog, fetchAuditLog } = useStore();

  useEffect(() => {
    if (isAuditPanelOpen) {
      fetchAuditLog();
    }
  }, [isAuditPanelOpen]);

  if (!isAuditPanelOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAuditPanelOpen(false); }}>
      <div className="modal-content" style={{ maxWidth: '520px', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-info">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="font-medium text-lg" style={{ fontSize: '1.05rem' }}>Audit Log</h2>
              <p className="text-xs text-tertiary">Chronological history of security & baseline verification events</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setAuditPanelOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Log Entries */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {auditLog.length === 0 ? (
            <div className="text-xs text-tertiary" style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '4px' }}>
              {[...auditLog].reverse().map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '3px' }}>
                    <div className="flex items-center" style={{ gap: '6px' }}>
                      {getEventIcon(entry.event)}
                      <span className="font-medium text-xs text-primary" style={{ fontSize: '0.775rem' }}>
                        {formatEventTitle(entry.event, entry.server, entry.tool)}
                      </span>
                    </div>
                    <span className="text-xs text-tertiary" style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>

                  <div className="text-xs text-secondary" style={{ paddingLeft: '20px', fontSize: '0.725rem' }}>
                    Server: {entry.server}{entry.tool ? ` · Tool: ${entry.tool}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatEventTitle(event: string, server: string, tool?: string): string {
  switch (event) {
    case 'SERVER_APPROVED': return `${server} approved & trusted`;
    case 'UPDATE_APPROVED': return `${server} / ${tool} update approved`;
    case 'TRUST_BASELINE_UPDATED': return `${server} baseline updated`;
    case 'MANIFEST_VERIFIED': return `${server} verified successfully`;
    case 'MANIFEST_MUTATION_DETECTED': return `Integrity change detected on ${server}`;
    case 'TOOL_SUSPENDED': return `${tool || 'Tool'} suspended on ${server}`;
    case 'UPDATE_REJECTED': return `Update rejected for ${server}`;
    case 'CROSS_SERVER_WARNING': return `Cross-server instruction detected`;
    case 'SIMULATION_STARTED': return `Attack simulation triggered`;
    case 'SIMULATION_RESET': return `Simulation state reset`;
    default: return event.replace(/_/g, ' ').toLowerCase();
  }
}

function getEventIcon(event: string) {
  switch (event) {
    case 'SERVER_APPROVED':
    case 'UPDATE_APPROVED':
    case 'TRUST_BASELINE_UPDATED':
    case 'MANIFEST_VERIFIED':
      return <ShieldCheck size={13} style={{ color: 'var(--sentinel-trusted)', flexShrink: 0 }} />;
    case 'MANIFEST_MUTATION_DETECTED':
    case 'TOOL_SUSPENDED':
    case 'UPDATE_REJECTED':
      return <ShieldAlert size={13} style={{ color: 'var(--sentinel-critical)', flexShrink: 0 }} />;
    case 'CROSS_SERVER_WARNING':
      return <AlertTriangle size={13} style={{ color: 'var(--sentinel-warning)', flexShrink: 0 }} />;
    case 'SIMULATION_STARTED':
      return <Play size={13} style={{ color: 'var(--sentinel-info)', flexShrink: 0 }} />;
    case 'SIMULATION_RESET':
      return <RotateCcw size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />;
    default:
      return <Shield size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
