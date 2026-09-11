import { X, Zap, RotateCcw, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect } from 'react';

export default function AttackSimulator() {
  const {
    isSimulatorOpen, setSimulatorOpen,
    scenarios, fetchScenarios,
    activeSimulation, simulateAttack, resetSimulation
  } = useStore();

  useEffect(() => {
    if (isSimulatorOpen) {
      fetchScenarios();
    }
  }, [isSimulatorOpen]);

  if (!isSimulatorOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSimulatorOpen(false); }}>
      <div className="modal-content" style={{ maxWidth: '520px', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-alert" style={{ background: 'var(--sentinel-warning-bg)', color: 'var(--sentinel-warning)' }}>
              <Zap size={16} />
            </div>
            <div>
              <h2 className="font-medium text-lg" style={{ fontSize: '1.05rem' }}>Attack Simulator</h2>
              <p className="text-xs text-tertiary">Interactive testing for Sentinel detection policies</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setSimulatorOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Simulation Banner */}
        <div style={{ padding: '10px 12px', background: 'var(--sentinel-warning-bg)', border: '1px solid var(--sentinel-warning-border)', borderRadius: 'var(--radius-md)', color: 'var(--sentinel-warning)', marginBottom: '12px' }}>
          <div className="flex items-start" style={{ gap: '6px' }}>
            <Info size={13} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span className="text-xs" style={{ lineHeight: 1.4 }}>
              Demonstration Mode — Scenarios simulate manifest mutations in-memory to test verification responses.
            </span>
          </div>
        </div>

        {/* Active Scenario Banner */}
        {activeSimulation && (
          <div style={{ padding: '10px 12px', background: 'var(--sentinel-critical-bg)', border: '1px solid var(--sentinel-critical-border)', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: '6px' }}>
                <ShieldAlert size={14} style={{ color: 'var(--sentinel-critical)' }} />
                <span className="text-xs font-medium text-primary">Active: {scenarios.find(s => s.id === activeSimulation)?.name || activeSimulation}</span>
              </div>
              <button className="btn" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={resetSimulation}>
                <RotateCcw size={11} /> Reset
              </button>
            </div>
          </div>
        )}

        {/* Scenarios List */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
          <div className="flex flex-col" style={{ gap: '8px' }}>
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                style={{
                  padding: '12px',
                  background: activeSimulation === scenario.id ? 'var(--sentinel-warning-bg)' : 'var(--bg-surface)',
                  border: `1px solid ${activeSimulation === scenario.id ? 'var(--sentinel-warning-border)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <div className="flex items-center" style={{ gap: '6px' }}>
                    {getSeverityIcon(scenario.severity)}
                    <span className="text-xs font-medium text-primary">{scenario.name}</span>
                  </div>
                  <span className="sentinel-mutation-badge">{scenario.severity.toUpperCase()}</span>
                </div>
                <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: 1.4 }}>
                  {scenario.description}
                </p>
                <button
                  className="btn w-full"
                  style={{ padding: '5px 10px', fontSize: '0.775rem', justifyContent: 'center' }}
                  onClick={() => simulateAttack(scenario.id)}
                  disabled={activeSimulation === scenario.id}
                >
                  <Zap size={12} /> {activeSimulation === scenario.id ? 'Active' : 'Run Scenario'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <AlertTriangle size={13} style={{ color: 'var(--sentinel-critical)' }} />;
    case 'warning':
      return <ShieldAlert size={13} style={{ color: 'var(--sentinel-warning)' }} />;
    default:
      return <Info size={13} style={{ color: 'var(--sentinel-info)' }} />;
  }
}
