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
      <div className="modal-content" style={{ maxWidth: '520px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <div className="sentinel-icon-sim">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="font-medium text-lg">Attack Simulator</h2>
              <p className="text-xs text-tertiary">Demo-only tool for testing Sentinel detection</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setSimulatorOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Simulation Banner */}
        <div className="simulator-banner">
          <Info size={14} />
          <span>SIMULATION ONLY — These scenarios modify manifest data in-memory without changing actual MCP servers.</span>
        </div>

        {/* Active Scenario */}
        {activeSimulation && (
          <div className="simulator-active">
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: '6px' }}>
                <ShieldAlert size={14} />
                <span className="text-sm font-medium">Active: {scenarios.find(s => s.id === activeSimulation)?.name || activeSimulation}</span>
              </div>
              <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={resetSimulation}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>
        )}

        {/* Scenarios */}
        <div style={{ overflowY: 'auto', flex: 1, marginTop: '12px' }}>
          <div className="flex flex-col" style={{ gap: '6px' }}>
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`simulator-scenario ${activeSimulation === scenario.id ? 'simulator-scenario-active' : ''}`}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <div className="flex items-center" style={{ gap: '8px' }}>
                    {getSeverityIcon(scenario.severity)}
                    <span className="text-sm font-medium">{scenario.name}</span>
                  </div>
                  <span className={`simulator-severity simulator-severity-${scenario.severity}`}>
                    {scenario.severity}
                  </span>
                </div>
                <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: 1.4 }}>
                  {scenario.description}
                </p>
                <button
                  className="btn w-full"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
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
      return <AlertTriangle size={14} style={{ color: 'var(--sentinel-critical)' }} />;
    case 'warning':
      return <ShieldAlert size={14} style={{ color: 'var(--sentinel-warning)' }} />;
    default:
      return <Info size={14} style={{ color: 'var(--text-tertiary)' }} />;
  }
}
