import { useState } from 'react';
import { ChevronDown, SlidersHorizontal, Check } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Header() {
  const { conversations, activeConversationId, mcpServers, setConnectModalOpen } = useStore();
  const [selectedModel, setSelectedModel] = useState('Gemini 3.5 Flash');
  const [isModelDropdownOpen, setModelDropdownOpen] = useState(false);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const title = activeConv ? activeConv.title : 'New conversation';

  const connectedServersCount = mcpServers.filter(s => s.status === 'connected').length;

  const models = [
    { id: 'gemini-flash', name: 'Gemini 3.5 Flash', tag: 'Fast & Capable' },
    { id: 'claude-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Reasoning' },
    { id: 'qwen-local', name: 'Qwen 2.5 9B (Local)', tag: 'Private / Ollama' }
  ];

  return (
    <header className="app-header">
      {/* Left: Conversation Title */}
      <div className="flex items-center" style={{ gap: '10px' }}>
        <h2 className="font-medium" style={{ fontSize: '0.925rem', color: 'var(--text-primary)' }}>
          {title}
        </h2>
      </div>

      {/* Right Controls */}
      <div className="flex items-center" style={{ gap: '12px' }}>
        {/* Connected Tools Badge */}
        <button
          onClick={() => setConnectModalOpen(true)}
          className="btn"
          style={{
            padding: '4px 10px',
            fontSize: '0.775rem',
            background: 'transparent',
            borderColor: 'var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            gap: '6px'
          }}
          title="Manage connected MCP tools"
        >
          <span className="status-dot status-connected"></span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {connectedServersCount > 0 ? `${connectedServersCount} connected` : 'Connect tools'}
          </span>
        </button>

        {/* Model Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setModelDropdownOpen(!isModelDropdownOpen)}
            className="btn"
            style={{
              padding: '4px 10px',
              fontSize: '0.775rem',
              background: 'transparent',
              borderColor: 'transparent',
              gap: '4px'
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{selectedModel}</span>
            <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />
          </button>

          {isModelDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '210px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-lg)',
                padding: '4px',
                zIndex: 50
              }}
            >
              {models.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.name);
                    setModelDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: selectedModel === m.name ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.825rem', fontWeight: selectedModel === m.name ? 500 : 400, color: 'var(--text-primary)' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{m.tag}</div>
                  </div>
                  {selectedModel === m.name && <Check size={14} style={{ color: 'var(--accent-color)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Menu / Settings Button */}
        <button className="btn-icon" title="Workspace options">
          <SlidersHorizontal size={15} />
        </button>
      </div>
    </header>
  );
}
