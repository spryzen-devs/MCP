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
      <div className="modal-content" style={{ maxWidth: '520px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-audit">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="font-medium text-lg">Security Audit Log</h2>
              <p className="text-xs text-tertiary">{auditLog.length} events recorded</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setAuditPanelOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {auditLog.length === 0 ? (
            <div className="text-sm text-tertiary" style={{ textAlign: 'center', padding: '32px' }}>
              No security events recorded yet.
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '2px' }}>
              {[...auditLog].reverse().map((entry) => (
                <div key={entry.id} className="audit-entry">
                  <div className="flex items-center" style={{ gap: '8px' }}>
                    {getEventIcon(entry.event)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center justify-between">
                        <span className={`audit-event-label audit-event-${getEventSeverity(entry.event)}`}>
                          {entry.event}
                        </span>
                        <span className="text-xs text-tertiary">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-secondary" style={{ marginTop: '2px' }}>
                        {entry.server}{entry.tool ? ` / ${entry.tool}` : ''}
                      </div>
                    </div>
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

function getEventIcon(event: string) {
  switch (event) {
    case 'SERVER_APPROVED':
    case 'UPDATE_APPROVED':
    case 'TRUST_BASELINE_UPDATED':
    case 'MANIFEST_VERIFIED':
      return <ShieldCheck size={14} style={{ color: 'var(--status-connected)', flexShrink: 0 }} />;
    case 'MANIFEST_MUTATION_DETECTED':
    case 'TOOL_SUSPENDED':
    case 'UPDATE_REJECTED':
      return <ShieldAlert size={14} style={{ color: 'var(--sentinel-warning)', flexShrink: 0 }} />;
    case 'CROSS_SERVER_WARNING':
      return <AlertTriangle size={14} style={{ color: 'var(--sentinel-critical)', flexShrink: 0 }} />;
    case 'SIMULATION_STARTED':
      return <Play size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
    case 'SIMULATION_RESET':
      return <RotateCcw size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />;
    default:
      return <Shield size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />;
  }
}

function getEventSeverity(event: string): string {
  if (['MANIFEST_MUTATION_DETECTED', 'TOOL_SUSPENDED', 'UPDATE_REJECTED', 'CROSS_SERVER_WARNING'].includes(event)) return 'warning';
  if (['SERVER_APPROVED', 'UPDATE_APPROVED', 'MANIFEST_VERIFIED', 'TRUST_BASELINE_UPDATED'].includes(event)) return 'success';
  return 'neutral';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
