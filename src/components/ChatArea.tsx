import { useStore } from '../store/useStore';
import ChatComposer from './ChatComposer';
import Header from './Header';
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { ToolExecutionState } from '../types';

export default function ChatArea() {
  const { conversations, activeConversationId, setConnectModalOpen } = useStore();

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Time-appropriate greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning.';
    if (hour < 18) return 'Good afternoon.';
    return 'Good evening.';
  };

  return (
    <div className="main-chat">
      {/* Restrained Application Header */}
      <Header />

      {/* Messages Area */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: '32px 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {!activeConversation || activeConversation.messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ marginTop: '-40px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {getGreeting()}
            </h1>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '8px', color: 'var(--text-secondary)' }}>
              What would you like to work on?
            </h2>
            <p className="text-sm text-tertiary" style={{ marginBottom: '32px', maxWidth: '420px', lineHeight: 1.5 }}>
              Your connected tools are available when you need them.
            </p>

            <div className="flex" style={{ gap: '10px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '560px' }}>
              <button
                className="suggestion-pill"
                onClick={() => setConnectModalOpen(true)}
              >
                <span>Explore connected tools</span>
              </button>
              <button
                className="suggestion-pill"
                onClick={() => {
                  const el = document.querySelector('textarea');
                  if (el) {
                    (el as HTMLTextAreaElement).value = 'Calculate 25 * 4 + 10';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.focus();
                  }
                }}
              >
                <span>Calculate something</span>
              </button>
              <button
                className="suggestion-pill"
                onClick={() => {
                  const el = document.querySelector('textarea');
                  if (el) {
                    (el as HTMLTextAreaElement).value = 'Search documents Q3 financial report';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.focus();
                  }
                }}
              >
                <span>Work with a document</span>
              </button>
              <button
                className="suggestion-pill"
                onClick={() => setConnectModalOpen(true)}
              >
                <span>Connect an MCP server</span>
              </button>
            </div>
          </div>
        ) : (
          activeConversation.messages.map(msg => (
            <div
              key={msg.id}
              className="flex flex-col"
              style={{
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '8px',
                width: '100%',
                maxWidth: '780px',
                margin: '0 auto'
              }}
            >
              {/* Tool Executions */}
              {msg.role === 'assistant' && msg.toolsUsed && msg.toolsUsed.map(tool => (
                <ToolExecutionBlock key={tool.id} tool={tool} />
              ))}

              <div
                className="markdown-content"
                style={{
                  maxWidth: msg.role === 'user' ? '85%' : '100%',
                  padding: msg.role === 'user' ? '10px 16px' : '0',
                  background: msg.role === 'user' ? 'var(--bg-surface)' : 'transparent',
                  borderRadius: msg.role === 'user' ? 'var(--radius-lg)' : '0',
                  border: msg.role === 'user' ? '1px solid var(--border-subtle)' : 'none',
                  boxShadow: msg.role === 'user' ? 'var(--shadow-sm)' : 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.925rem',
                  lineHeight: 1.6
                }}
              >
                {msg.content.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <ChatComposer />
    </div>
  );
}

function ToolExecutionBlock({ tool }: { tool: ToolExecutionState }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        padding: '10px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.825rem',
        minWidth: '300px',
        maxWidth: '100%',
        marginBottom: '6px',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: tool.status === 'running' ? '0' : '8px' }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          {tool.status === 'running' ? (
            <Loader2 size={13} className="animate-spin" style={{ color: 'var(--status-connecting)' }} />
          ) : tool.status === 'completed' ? (
            <CheckCircle2 size={13} style={{ color: 'var(--sentinel-trusted)' }} />
          ) : (
            <AlertCircle size={13} style={{ color: 'var(--sentinel-critical)' }} />
          )}
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {tool.serverName}.{tool.toolName}
          </span>
        </div>

        <div className="flex items-center" style={{ gap: '6px' }}>
          <span className="sentinel-status-badge sentinel-status-trusted" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
            <ShieldCheck size={10} style={{ marginRight: '3px' }} /> Verified
          </span>
        </div>
      </div>

      {tool.arguments && Object.keys(tool.arguments).length > 0 && (
        <div className="text-xs text-secondary" style={{ marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
          <span className="text-tertiary">input: </span>
          {JSON.stringify(tool.arguments)}
        </div>
      )}

      {tool.status === 'completed' && tool.result !== undefined && (
        <div className="text-xs" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
          <span className="text-tertiary">result: </span>
          {typeof tool.result === 'object' ? JSON.stringify(tool.result) : String(tool.result)}
        </div>
      )}

      {tool.error && (
        <div className="text-xs" style={{ color: 'var(--sentinel-critical)', marginTop: '2px' }}>
          {tool.error}
        </div>
      )}
    </div>
  );
}
