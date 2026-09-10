import { X, ShieldAlert, AlertTriangle, Bot } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useState } from 'react';

export default function CodeMutationAlertModal() {
  const { codeMutationAlert, setCodeMutationAlert, fetchSentinelStatus } = useStore();
  const [isApproving, setIsApproving] = useState(false);

  if (!codeMutationAlert) return null;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`http://localhost:3001/api/mcp/${codeMutationAlert.serverId}/approve-code`, {
        method: 'POST'
      });
      if (response.ok) {
        setCodeMutationAlert(null);
        await fetchSentinelStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsApproving(false);
    }
  };

  const handleClose = () => {
    setCodeMutationAlert(null);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-alert">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="font-medium text-lg">Code-Level Mutation Detected (Zero-Trust)</h2>
              <p className="text-sm text-secondary">{codeMutationAlert.serverId}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* AI Insight */}
        {codeMutationAlert.insight && (
          <div className="sentinel-ai-insight" style={{ marginBottom: '16px' }}>
            <div className="flex items-center" style={{ gap: '8px', marginBottom: '8px' }}>
              <Bot size={16} className="text-primary" />
              <span className="font-medium text-sm">Ollama Security Analysis (qwen3.5:9b)</span>
            </div>
            <p className="text-sm text-secondary" style={{ lineHeight: 1.5 }}>
              {codeMutationAlert.insight.summary}
            </p>
            <div className="flex" style={{ gap: '8px', marginTop: '12px' }}>
              {codeMutationAlert.insight.isDataLossRisk && (
                <span className="sentinel-mutation-badge" style={{ background: 'var(--sentinel-critical-bg)', color: 'var(--sentinel-critical)', borderColor: 'rgba(220, 38, 38, 0.2)' }}>
                  <AlertTriangle size={12} /> Data Loss Risk
                </span>
              )}
              {codeMutationAlert.insight.isDataTheftRisk && (
                <span className="sentinel-mutation-badge" style={{ background: 'var(--sentinel-critical-bg)', color: 'var(--sentinel-critical)', borderColor: 'rgba(220, 38, 38, 0.2)' }}>
                  <AlertTriangle size={12} /> Data Theft Risk
                </span>
              )}
            </div>
          </div>
        )}

        {/* Diff content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Trusted Baseline Code</h4>
              <pre className="text-xs" style={{ background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)', overflow: 'auto', border: '1px solid var(--border-subtle)', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                {codeMutationAlert.oldCode || 'No previous baseline found'}
              </pre>
            </div>
            <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Mutated Code (Current)</h4>
              <pre className="text-xs" style={{ background: 'rgba(220, 38, 38, 0.05)', padding: '12px', borderRadius: 'var(--radius-sm)', overflow: 'auto', border: '1px solid rgba(220, 38, 38, 0.2)', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                {codeMutationAlert.newCode ? 
                  codeMutationAlert.newCode.split('\n').map((line: string, i: number) => {
                    const isMutated = codeMutationAlert.oldCode && line.trim().length > 0 && !codeMutationAlert.oldCode.split('\n').map((l: string) => l.trim()).includes(line.trim());
                    return (
                      <div key={i} style={{
                        backgroundColor: isMutated ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                        color: isMutated ? 'var(--sentinel-critical)' : 'inherit',
                        fontWeight: isMutated ? 'bold' : 'normal',
                        padding: '0 4px',
                        margin: '0 -4px',
                        borderRadius: '2px',
                        minHeight: '1em'
                      }}>
                        {line}
                      </div>
                    );
                  })
                : codeMutationAlert.newCode}
              </pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end" style={{ gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn" onClick={handleClose}>
            Reject Connection
          </button>
          <button 
            className="btn btn-primary" 
            style={{ background: 'var(--sentinel-critical)' }} 
            onClick={handleApprove}
            disabled={isApproving}
          >
            {isApproving ? 'Approving...' : 'Approve Mutated Code & Connect'}
          </button>
        </div>

      </div>
    </div>
  );
}
