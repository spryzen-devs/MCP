import { Plus, MessageSquare, TerminalSquare, Shield, Clock, Zap, Cpu } from 'lucide-react';
import { useStore } from '../store/useStore';
import MCPConnectionItem from './MCPConnectionItem';

export default function Sidebar() {
  const {
    conversations, mcpServers, createNewConversation,
    setConnectModalOpen, activeConversationId, setActiveConversationId,
    setTrustPanelOpen, setAuditPanelOpen, setSimulatorOpen
  } = useStore();

  const connectedCount = mcpServers.filter(s => s.status === 'connected').length;

  return (
    <div className="sidebar">
      {/* Brand Header */}
      <div className="flex items-center justify-between" style={{ padding: '16px 18px 12px' }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            background: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <TerminalSquare size={12} />
          </div>
          <span className="font-medium" style={{ fontSize: '0.95rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Sentinel
          </span>
        </div>
        <button
          className="btn-icon"
          onClick={createNewConversation}
          title="New conversation"
          style={{ padding: '4px' }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Main Content Areas */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* CHAT SECTION */}
        <div>
          <div className="flex items-center justify-between" style={{ padding: '4px 8px', marginBottom: '4px' }}>
            <span className="text-xs font-medium text-tertiary uppercase" style={{ letterSpacing: '0.06em', fontSize: '0.675rem' }}>
              Chat
            </span>
          </div>

          <div className="flex flex-col" style={{ gap: '2px' }}>
            <button
              onClick={createNewConversation}
              className="sidebar-nav-item"
              style={{ fontWeight: 500, color: 'var(--text-primary)' }}
            >
              <Plus size={14} style={{ opacity: 0.8 }} />
              <span>New conversation</span>
            </button>

            {conversations.map(conv => {
              const isActive = activeConversationId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  <MessageSquare size={14} style={{ opacity: isActive ? 0.9 : 0.55 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TOOLS SECTION */}
        <div>
          <div className="flex items-center justify-between" style={{ padding: '4px 8px', marginBottom: '6px' }}>
            <span className="text-xs font-medium text-tertiary uppercase" style={{ letterSpacing: '0.06em', fontSize: '0.675rem' }}>
              Tools
            </span>
            <span className="text-xs text-tertiary" style={{ fontSize: '0.7rem' }}>
              {connectedCount}/{mcpServers.length}
            </span>
          </div>

          <div className="flex flex-col" style={{ gap: '4px' }}>
            {mcpServers.map(server => (
              <MCPConnectionItem key={server.id} server={server} />
            ))}

            <button
              className="sidebar-nav-item"
              onClick={() => setConnectModalOpen(true)}
              style={{ marginTop: '2px', borderStyle: 'dashed', color: 'var(--text-tertiary)' }}
            >
              <Cpu size={14} />
              <span>Connect MCP server</span>
            </button>
          </div>
        </div>

        {/* SECURITY SECTION */}
        <div>
          <div className="flex items-center justify-between" style={{ padding: '4px 8px', marginBottom: '4px' }}>
            <span className="text-xs font-medium text-tertiary uppercase" style={{ letterSpacing: '0.06em', fontSize: '0.675rem' }}>
              Security
            </span>
          </div>

          <div className="flex flex-col" style={{ gap: '2px' }}>
            <button
              className="sidebar-nav-item"
              onClick={() => setTrustPanelOpen(true)}
            >
              <Shield size={14} style={{ opacity: 0.7 }} />
              <span>Trust Registry</span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => setAuditPanelOpen(true)}
            >
              <Clock size={14} style={{ opacity: 0.7 }} />
              <span>Audit Log</span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => setSimulatorOpen(true)}
              style={{ color: 'var(--sentinel-warning)' }}
            >
              <Zap size={14} />
              <span>Attack Simulator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Status Area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(0, 0, 0, 0.015)'
      }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <span className="status-dot status-connected"></span>
          <span style={{ fontSize: '0.775rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Sentinel active
          </span>
        </div>
        <div className="text-xs text-tertiary" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
          Zero-trust tool protection
        </div>
      </div>
    </div>
  );
}
