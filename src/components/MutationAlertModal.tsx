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
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="font-medium text-lg" style={{ fontSize: '1.05rem' }}>Integrity Change Detected</h2>
              <p className="text-xs text-secondary">{mutationAlert.serverName || 'MCP Server'}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Status Callout Box */}
        <div style={{
          padding: '12px 14px',
          background: 'rgba(201, 59, 59, 0.06)',
          border: '1px solid var(--sentinel-critical-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px'
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--sentinel-critical)' }}>
              Execution Suspended
            </span>
            <span className="sentinel-status-badge sentinel-status-suspended">
              SUSPENDED
            </span>
          </div>
          <p className="text-xs text-secondary" style={{ lineHeight: 1.45 }}>
            The server's current tool definition differs from the approved baseline. Sentinel has blocked execution until reviewed.
          </p>
        </div>

        {/* Cross-Server Warnings */}
        {crossServerWarnings.length > 0 && (
          <div className="sentinel-cross-server-banner">
            <div className="flex items-center" style={{ gap: '6px', marginBottom: '6px' }}>
              <AlertTriangle size={15} />
              <span className="font-medium text-xs">Cross-Server Behavior Detected</span>
            </div>
            {crossServerWarnings.map((w, i) => (
              <div key={i} className="text-xs" style={{ marginBottom: '4px' }}>
                <div><strong>Source:</strong> {w.sourceServer} → {w.sourceTool}</div>
                <div><strong>Target:</strong> {w.referencedTarget}</div>
                <div><strong>Behavior:</strong> {w.suspiciousBehavior}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable content area */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {suspendedTools.map((tool, idx) => (
            <div key={idx} className="sentinel-tool-alert" style={{ marginBottom: '16px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                <div>
                  <div className="font-medium text-sm">{tool.tool}</div>
                  {tool.mutationCategories && (
                    <div className="flex" style={{ gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {tool.mutationCategories.map((cat, i) => (
                        <span key={i} className="sentinel-mutation-badge">{cat}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SHA-256 Fingerprints Comparison */}
              <div className="sentinel-fingerprints" style={{ marginBottom: '12px' }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-tertiary">Approved Fingerprint</span>
                  <code className="text-xs text-secondary">{tool.baselineHash ? tool.baselineHash.substring(0, 20) + '...' : 'N/A'}</code>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-tertiary">Current Fingerprint</span>
                  <code className="text-xs" style={{ color: 'var(--sentinel-critical)' }}>{tool.currentHash ? tool.currentHash.substring(0, 20) + '...' : 'N/A'}</code>
                </div>
              </div>

              {/* Approved vs Current Manifest Diff */}
              {tool.diff && tool.diff.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.05em', fontSize: '0.675rem' }}>
                    Manifest Changes
                  </div>
                  <ManifestDiffView diffs={tool.diff} />
                </div>
              )}

              {/* AI Security Review Advisory (Ollama / Qwen) */}
              {tool.aiInsights && (
                <div style={{
                  marginTop: '14px',
                  padding: '12px',
                  background: 'var(--sentinel-info-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(72, 114, 148, 0.2)'
                }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                    <div className="flex items-center" style={{ gap: '6px' }}>
                      <Bot size={14} style={{ color: 'var(--sentinel-info)' }} />
                      <span className="text-xs font-medium uppercase" style={{ color: 'var(--sentinel-info)', letterSpacing: '0.04em' }}>
                        Advisory AI Security Analysis
                      </span>
                    </div>
                    <span className="text-xs text-tertiary" style={{ fontSize: '0.675rem' }}>Ollama / Qwen</span>
                  </div>
                  <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: 1.45 }}>
                    {tool.aiInsights.summary}
                  </p>
                  <div className="flex" style={{ gap: '12px' }}>
                    <div className="flex items-center" style={{ gap: '4px' }}>
                      {tool.aiInsights.isDataLossRisk ? <ShieldAlert size={13} style={{ color: 'var(--sentinel-critical)' }} /> : <ShieldCheck size={13} style={{ color: 'var(--sentinel-trusted)' }} />}
                      <span className="text-xs text-secondary">{tool.aiInsights.isDataLossRisk ? 'High Data Loss Risk' : 'Low Data Loss Risk'}</span>
                    </div>
                    <div className="flex items-center" style={{ gap: '4px' }}>
                      {tool.aiInsights.isDataTheftRisk ? <ShieldAlert size={13} style={{ color: 'var(--sentinel-critical)' }} /> : <ShieldCheck size={13} style={{ color: 'var(--sentinel-trusted)' }} />}
                      <span className="text-xs text-secondary">{tool.aiInsights.isDataTheftRisk ? 'High Data Theft Risk' : 'Low Data Theft Risk'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex" style={{ gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  style={{ color: 'var(--sentinel-critical)', borderColor: 'var(--sentinel-critical-border)', padding: '7px 14px' }}
                  onClick={() => handleReject(tool)}
                >
                  Reject Change
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: '7px 14px' }}
                  onClick={() => handleApprove(tool)}
                >
                  <ShieldCheck size={14} /> Review & Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
