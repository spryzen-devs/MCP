import React, { useEffect, useState, useRef } from 'react';
import { X, Terminal, Code, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function LiveAnalysisModal() {
  const { isLiveAnalysisOpen, setLiveAnalysisOpen, liveAnalysisServerId, fetchSentinelStatus } = useStore();
  const [status, setStatus] = useState<string>('Initializing...');
  const [code, setCode] = useState<string>('');
  const [llmStream, setLlmStream] = useState<string>('');
  const [finalReview, setFinalReview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLiveAnalysisOpen || !liveAnalysisServerId) {
      // Reset state when closed
      setStatus('Initializing...');
      setCode('');
      setLlmStream('');
      setFinalReview(null);
      setError(null);
      return;
    }

    setStatus('Connecting to Sentinel Gateway...');
    const es = new EventSource(`http://localhost:3001/api/mcp/${liveAnalysisServerId}/connect-stream`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setStatus('Connected successfully (No review required)');
          fetchSentinelStatus();
          es.close();
          setTimeout(() => setLiveAnalysisOpen(false), 1500);
        } else if (data.type === 'code_extracted') {
          setStatus('Code extracted. Preparing analysis...');
          setCode(data.payload.code);
        } else if (data.type === 'analysis_started') {
          setStatus('Running Static Analysis...');
        } else if (data.type === 'llm_started') {
          setStatus('Streaming AI Analysis from Qwen...');
        } else if (data.type === 'llm_chunk') {
          setLlmStream((prev) => prev + data.payload.chunk);
        } else if (data.type === 'review_complete') {
          setStatus('Analysis Complete');
          setFinalReview(data.payload.reviewData);
          es.close();
        } else if (data.type === 'code_mutation_detected') {
           setStatus('Code mutation detected! Streaming AI insights...');
           setCode(`// OLD CODE:\n${data.payload.oldCode}\n\n// NEW CODE:\n${data.payload.newCode}`);
        } else if (data.type === 'mutation_complete') {
           setStatus('Mutation Analysis Complete');
           setFinalReview(data.payload.mutationData);
           es.close();
        } else if (data.type === 'error') {
          setError(data.payload);
          es.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE event', e);
      }
    };

    es.onerror = (e) => {
      console.error('SSE Error:', e);
      setError('Connection lost to Sentinel stream.');
      es.close();
    };

    return () => {
      es.close();
    };
  }, [isLiveAnalysisOpen, liveAnalysisServerId]);

  useEffect(() => {
    // Auto-scroll terminal
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [llmStream]);

  if (!isLiveAnalysisOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', width: '90vw', maxWidth: '1200px', height: '85vh', padding: 0, backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="sentinel-icon-trust" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Live Security Analysis: {liveAnalysisServerId}</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ position: 'relative', display: 'flex', height: '8px', width: '8px' }}>
                  <span style={{ animation: (status.includes('Complete') || error) ? 'none' : 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: '#34d399', opacity: 0.75 }}></span>
                  <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', backgroundColor: status.includes('Complete') ? '#10b981' : error ? '#ef4444' : '#10b981' }}></span>
                </span>
                {status}
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setLiveAnalysisOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left: Code Snippet */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '50%', borderRight: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              <Code size={16} /> Extracted Server Code
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre' }}>
              {code || 'Awaiting code extraction...'}
            </div>
          </div>

          {/* Right: LLM Terminal */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '50%', backgroundColor: '#000' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: '#9ca3af' }}>
              <Terminal size={16} /> Qwen 3.5 Thought Stream
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', color: '#4ade80', fontFamily: 'monospace', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {llmStream || (error ? <span style={{ color: '#ef4444' }}>{error}</span> : 'Awaiting LLM connection...')}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>

        {/* Footer actions when complete */}
        {finalReview && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px' }}>
              <span style={{ fontWeight: 600 }}>Analysis Verdict: </span> 
              <span style={{ color: (finalReview.aiReview?.overallRisk === 'HIGH' || finalReview.overallRisk === 'HIGH' || finalReview.insight?.isDataTheftRisk) ? '#ef4444' : '#eab308', fontWeight: 'bold' }}>
                {finalReview.aiReview?.overallRisk || finalReview.overallRisk || (finalReview.insight?.isDataTheftRisk ? 'HIGH' : 'REVIEW_REQUIRED')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn" onClick={() => setLiveAnalysisOpen(false)}>
                Reject & Close
              </button>
              <button 
                className="btn btn-primary"
                style={{ backgroundColor: '#dc2626', color: 'white' }}
                onClick={async () => {
                  const { useStore } = await import('../store/useStore');
                  const uiId = liveAnalysisServerId === 'calculator' ? 'server-calc' 
                    : liveAnalysisServerId === 'email' ? 'server-email' 
                    : liveAnalysisServerId === 'calculatormcp2' ? 'server-calcmcp2'
                    : liveAnalysisServerId === 'documentsearch' ? 'server-docsearch'
                    : liveAnalysisServerId;
                  await useStore.getState().approveServer(uiId);
                  useStore.getState().fetchSentinelStatus();
                  setLiveAnalysisOpen(false);
                }}
              >
                Acknowledge Risk & Approve
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
