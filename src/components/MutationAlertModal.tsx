import { X, ShieldAlert, ShieldCheck, AlertTriangle, Bot } from 'lucide-react';
import { useStore } from '../store/useStore';
import ManifestDiffView from './ManifestDiffView';
import type { ToolIntegrityResult } from '../types';

export default function MutationAlertModal() {
  const { mutationAlert, setMutationAlert, approveToolUpdate, rejectToolUpdate, fetchSentinelStatus } = useStore();

  if (!mutationAlert) return null;

  const suspendedTools = mutationAlert.toolResults.filter(
    t => t.status === 'suspended' || t.action === 'suspend'
  );
  const crossServerWarnings = mutationAlert.crossServerWarnings || [];

  const handleApprove = async (tool: ToolIntegrityResult) => {
    await approveToolUpdate(tool.server, tool.tool);
    await fetchSentinelStatus();
  };

  const handleReject = async (tool: ToolIntegrityResult) => {
    await rejectToolUpdate(tool.server, tool.tool);
    await fetchSentinelStatus();
  };

  const handleClose = () => {
    setMutationAlert(null);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-alert">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="font-medium text-lg">Manifest Integrity Violation</h2>
              <p className="text-sm text-secondary">{mutationAlert.serverName}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Cross-Server Warnings */}
        {crossServerWarnings.length > 0 && (
          <div className="sentinel-cross-server-banner">
            <div className="flex items-center" style={{ gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={16} />
              <span className="font-medium">Cross-Server Instruction Detected</span>
            </div>
            {crossServerWarnings.map((w, i) => (
              <div key={i} className="text-sm" style={{ marginBottom: '4px' }}>
                <div><strong>Source:</strong> {w.sourceServer} → {w.sourceTool}</div>
                <div><strong>Referenced target:</strong> {w.referencedTarget}</div>
                <div><strong>Suspicious behavior:</strong> {w.suspiciousBehavior}</div>
                <div className="text-xs text-tertiary" style={{ marginTop: '2px' }}>Pattern: {w.matchedPattern}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {suspendedTools.map((tool, idx) => (
            <div key={idx} className="sentinel-tool-alert" style={{ marginBottom: '16px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <div>
                  <div className="font-medium">{tool.tool}</div>
                  {tool.mutationCategories && (
                    <div className="flex" style={{ gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {tool.mutationCategories.map((cat, i) => (
                        <span key={i} className="sentinel-mutation-badge">{cat}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="sentinel-status-badge sentinel-status-suspended">SUSPENDED</span>
              </div>

              {/* Fingerprints */}
              <div className="sentinel-fingerprints">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary">Trusted fingerprint</span>
                  <code className="text-xs">{tool.baselineHash ? tool.baselineHash.substring(0, 16) + '...' : 'N/A'}</code>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary">Current fingerprint</span>
                  <code className="text-xs">{tool.currentHash ? tool.currentHash.substring(0, 16) + '...' : 'N/A'}</code>
                </div>
              </div>

              {/* Diff */}
              {tool.diff && tool.diff.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '8px', letterSpacing: '0.05em' }}>
                    Changes Detected
                  </div>
                  <ManifestDiffView diffs={tool.diff} />
                </div>
              )}

              {/* AI Security Insights */}
              {tool.aiInsights && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <div className="flex items-center" style={{ gap: '6px' }}>
                      <Bot size={14} style={{ color: '#38bdf8' }} />
                      <span className="text-xs font-medium uppercase" style={{ color: '#38bdf8', letterSpacing: '0.05em' }}>AI Security Insights (Qwen 0.5b)</span>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
                    {tool.aiInsights.summary}
                  </p>
                  <div className="flex" style={{ gap: '12px' }}>
                    <div className="flex items-center" style={{ gap: '4px' }}>
                      {tool.aiInsights.isDataLossRisk ? <ShieldAlert size={14} style={{ color: 'var(--status-error)' }} /> : <ShieldCheck size={14} style={{ color: 'var(--status-connected)' }} />}
                      <span className="text-xs">{tool.aiInsights.isDataLossRisk ? 'High Data Loss Risk' : 'Low Data Loss Risk'}</span>
                    </div>
                    <div className="flex items-center" style={{ gap: '4px' }}>
                      {tool.aiInsights.isDataTheftRisk ? <ShieldAlert size={14} style={{ color: 'var(--status-error)' }} /> : <ShieldCheck size={14} style={{ color: 'var(--status-connected)' }} />}
                      <span className="text-xs">{tool.aiInsights.isDataTheftRisk ? 'High Data Theft Risk' : 'Low Data Theft Risk'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex" style={{ gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  style={{ color: 'var(--status-error)', borderColor: 'rgba(220, 38, 38, 0.2)' }}
                  onClick={() => handleReject(tool)}
                >
                  Reject Update
                </button>
                <button
                  className="btn"
                  style={{ background: 'var(--status-connected)', color: 'white', border: 'none' }}
                  onClick={() => handleApprove(tool)}
                >
                  <ShieldCheck size={14} /> Approve & Trust
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-tertiary" style={{ marginTop: '12px', textAlign: 'center' }}>
          The approved tool manifest has changed. Execution has been suspended until reviewed.
        </div>
      </div>
    </div>
  );
}
