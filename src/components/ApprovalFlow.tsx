import { ShieldCheck, X, Server, ShieldAlert, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Props {
  verification: any;
  onClose: () => void;
}

export default function ApprovalFlow({ verification, onClose }: Props) {
  const { approveServer, fetchSentinelStatus } = useStore();

  const serverUiId = verification.serverId === 'calculator' ? 'server-calc'
    : verification.serverId === 'email' ? 'server-email'
    : 'server-calcmcp2';

  const handleApprove = async () => {
    await approveServer(serverUiId);
    await fetchSentinelStatus();
    onClose();
  };

  const isSecurityReview = verification.isNewSecurityReview;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: '560px', maxHeight: '88vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-trust">
              {isSecurityReview && verification.aiReview?.overallRisk === 'HIGH' ? <ShieldAlert size={18} /> : <Server size={18} />}
            </div>
            <div>
              <h2 className="font-medium text-lg" style={{ fontSize: '1.05rem' }}>
                {isSecurityReview ? 'Security Review Required' : 'Approve MCP Server'}
              </h2>
              <p className="text-xs text-secondary">{verification.serverName || verification.serverId}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {isSecurityReview ? (
          <>
            <div style={{
              background: 'var(--bg-app)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px'
            }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <span className="text-xs font-medium text-secondary flex items-center" style={{ gap: '6px' }}>
                  <ShieldAlert size={13} style={{ color: 'var(--sentinel-warning)' }} /> AI Security Review (Qwen/Ollama)
                </span>
                <span className="sentinel-status-badge sentinel-status-pending_approval">
                  ADVISORY REVIEW
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <div style={{ flex: 1, padding: '10px', background: 'var(--sentinel-warning-bg)', border: '1px solid var(--sentinel-warning-border)', borderRadius: '6px' }}>
                  <div className="text-xs text-tertiary uppercase mb-1" style={{ fontSize: '0.65rem' }}>Overall Risk</div>
                  <div className="font-bold text-sm" style={{ color: verification.aiReview?.overallRisk === 'HIGH' ? 'var(--sentinel-critical)' : 'var(--sentinel-warning)' }}>
                    {verification.aiReview?.overallRisk || 'UNKNOWN'}
                  </div>
                </div>
                <div style={{ flex: 1, padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                  <div className="text-xs text-tertiary uppercase mb-1" style={{ fontSize: '0.65rem' }}>Recommendation</div>
                  <div className="font-bold text-sm text-primary">
                    {verification.aiReview?.recommendation || 'REVIEW'}
                  </div>
                </div>
              </div>

              <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.04em', fontSize: '0.65rem' }}>Findings</div>
              <div className="flex flex-col" style={{ gap: '8px' }}>
                {verification.aiReview?.findings?.map((f: any, i: number) => (
                  <div key={i} style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', borderLeft: `3px solid ${f.severity === 'HIGH' ? 'var(--sentinel-critical)' : 'var(--sentinel-warning)'}` }}>
                    <div className="font-medium text-xs mb-1">{f.title || f.category}</div>
                    <div className="text-xs text-secondary mb-1" style={{ lineHeight: 1.4 }}>{f.explanation}</div>
                    <code className="text-xs text-tertiary" style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.7rem' }}>Evidence: {f.evidence}</code>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.04em', fontSize: '0.65rem' }}>Static Analysis Baseline</div>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                {verification.staticFindings?.length > 0 ? (
                  verification.staticFindings.map((sf: any, i: number) => (
                    <div key={i} className="flex items-start" style={{ gap: '8px', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <ShieldAlert size={14} color={sf.severity === 'HIGH' ? 'var(--sentinel-critical)' : 'var(--sentinel-warning)'} style={{ marginTop: '2px' }} />
                      <div>
                        <div className="text-xs font-medium">{sf.category}</div>
                        <div className="text-xs text-secondary">Line {sf.line}: {sf.description}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center text-xs text-secondary" style={{ gap: '6px', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px' }}>
                    <CheckCircle size={14} color="var(--sentinel-trusted)" /> Clean static analysis baseline.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-secondary" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
              This MCP server has been discovered and is requesting permission to register tools. Review its declared capabilities before approving.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <div className="text-xs font-medium text-tertiary uppercase mb-2" style={{ letterSpacing: '0.05em', fontSize: '0.675rem' }}>
                Discovered Tools ({verification.toolResults?.length || 0})
              </div>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                {verification.toolResults?.map((tool: any, idx: number) => (
                  <div key={idx} style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div className="font-medium text-xs text-primary">{tool.tool}</div>
                    <div className="flex items-center" style={{ gap: '6px', marginTop: '4px' }}>
                      <code className="text-xs text-tertiary" style={{ fontSize: '0.7rem' }}>SHA-256: {tool.currentHash ? tool.currentHash.substring(0, 16) + '...' : 'Baseline'}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {verification.crossServerWarnings?.length > 0 && (
              <div className="sentinel-cross-server-banner" style={{ marginBottom: '16px' }}>
                <span className="text-xs font-medium">⚠ Cross-server instructions detected in tool descriptions. Review carefully.</span>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex" style={{ gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn" onClick={onClose} style={{ color: 'var(--sentinel-critical)', borderColor: 'var(--sentinel-critical-border)' }}>
            Reject Server
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApprove}
          >
            <ShieldCheck size={14} /> Approve & Establish Trust
          </button>
        </div>
      </div>
    </div>
  );
}
