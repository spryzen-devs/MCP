import { ShieldCheck, X, Server, ShieldAlert, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Props {
  verification: any; // Can be ServerVerificationResult or NewSecurityReview
  onClose: () => void;
}

export default function ApprovalFlow({ verification, onClose }: Props) {
  const { approveServer, fetchSentinelStatus } = useStore();

  const serverUiId = verification.serverId === 'calculator' ? 'server-calc' : verification.serverId === 'email' ? 'server-email' : 'server-calcmcp2';

  const handleApprove = async () => {
    // If it's a new security review, we need to call approve-code endpoint which connects and approves it.
    // Actually, `approveServer` calls `/api/mcp/:id/approve-code`. 
    await approveServer(serverUiId);
    await fetchSentinelStatus();
    onClose();
  };

  const isSecurityReview = verification.isNewSecurityReview;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>

        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-trust" style={{ background: isSecurityReview ? (verification.aiReview?.overallRisk === 'HIGH' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(234, 179, 8, 0.1)') : undefined, color: isSecurityReview ? (verification.aiReview?.overallRisk === 'HIGH' ? '#dc2626' : '#eab308') : undefined }}>
              {isSecurityReview && verification.aiReview?.overallRisk === 'HIGH' ? <ShieldAlert size={18} /> : <Server size={18} />}
            </div>
            <div>
              <h2 className="font-medium text-lg">{isSecurityReview ? 'Security Review Required' : 'Approve MCP Server'}</h2>
              <p className="text-sm text-secondary">{verification.serverName || verification.serverId}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isSecurityReview ? (
          <>
            <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              <h3 className="text-sm font-medium mb-3 flex items-center" style={{ gap: '6px' }}><ShieldAlert size={14} /> AI Security Review (Qwen/Ollama)</h3>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, padding: '12px', background: 'rgba(220, 38, 38, 0.05)', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: '6px' }}>
                  <div className="text-xs text-secondary uppercase mb-1">Overall Risk</div>
                  <div className="font-bold text-lg" style={{ color: verification.aiReview?.overallRisk === 'HIGH' ? '#dc2626' : '#eab308' }}>
                    {verification.aiReview?.overallRisk || 'UNKNOWN'}
                  </div>
                </div>
                <div style={{ flex: 1, padding: '12px', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                  <div className="text-xs text-secondary uppercase mb-1">Recommendation</div>
                  <div className="font-bold text-lg">
                    {verification.aiReview?.recommendation || 'REVIEW'}
                  </div>
                </div>
              </div>

              <div className="text-xs font-medium text-tertiary uppercase mb-2">Findings</div>
              <div className="flex flex-col" style={{ gap: '8px' }}>
                {verification.aiReview?.findings?.map((f: any, i: number) => (
                  <div key={i} style={{ padding: '10px', background: 'var(--bg-panel)', borderRadius: '4px', borderLeft: `3px solid ${f.severity === 'HIGH' ? '#dc2626' : '#eab308'}` }}>
                    <div className="font-medium text-sm mb-1">{f.title || f.category}</div>
                    <div className="text-xs text-secondary mb-2">{f.explanation}</div>
                    <code className="text-xs" style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '2px' }}>Evidence: {f.evidence}</code>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 className="text-sm font-medium mb-3">Deterministic Static Analysis</h3>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                {verification.staticFindings?.length > 0 ? (
                  verification.staticFindings.map((sf: any, i: number) => (
                    <div key={i} className="flex items-start" style={{ gap: '8px', padding: '8px', background: 'var(--bg-panel)', borderRadius: '4px' }}>
                      <ShieldAlert size={14} color={sf.severity === 'HIGH' ? '#dc2626' : '#eab308'} style={{ marginTop: '2px' }} />
                      <div>
                        <div className="text-sm font-medium">{sf.category}</div>
                        <div className="text-xs text-secondary">Line {sf.line}: {sf.description}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center text-sm text-secondary" style={{ gap: '6px' }}>
                    <CheckCircle size={14} color="#10b981" /> No static analysis warnings.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-secondary" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
              This server has been discovered and is requesting trust. Review the tools it provides, then approve to establish a trusted baseline.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <div className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '8px', letterSpacing: '0.05em' }}>
                Discovered Tools ({verification.toolResults?.length || 0})
              </div>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                {verification.toolResults?.map((tool: any, idx: number) => (
                  <div key={idx} className="sentinel-tool-item">
                    <div className="font-medium text-sm">{tool.tool}</div>
                    <div className="flex items-center" style={{ gap: '6px', marginTop: '4px' }}>
                      <code className="text-xs text-tertiary">SHA-256: {tool.currentHash.substring(0, 16)}...</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {verification.crossServerWarnings?.length > 0 && (
              <div className="sentinel-cross-server-banner" style={{ marginBottom: '16px' }}>
                <span className="text-sm font-medium">⚠ Cross-server instructions detected in tool descriptions. Review carefully.</span>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex" style={{ gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn" onClick={onClose} style={{ border: '1px solid #dc2626', color: '#dc2626', background: 'transparent' }}>
            Reject Server
          </button>
          <button
            className="btn"
            style={{ background: isSecurityReview && verification.aiReview?.overallRisk === 'HIGH' ? 'var(--bg-panel)' : 'var(--status-connected)', color: isSecurityReview && verification.aiReview?.overallRisk === 'HIGH' ? 'var(--text-secondary)' : 'white', border: 'none' }}
            onClick={handleApprove}
          >
            <ShieldCheck size={14} /> Approve & Establish Trust
          </button>
        </div>
      </div>
    </div>
  );
}
