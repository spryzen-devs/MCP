import { useState } from 'react';
import { Paperclip, Wrench, ArrowUp, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { calculateExpression, sendMockEmail, readMockEmails, searchDocuments } from '../services/chat-api';

export default function ChatComposer() {
  const [input, setInput] = useState('');
  const [showToolsPopover, setShowToolsPopover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addMessage, activeConversationId, createNewConversation, mcpServers, setConnectModalOpen } = useStore();

  const connectedServers = mcpServers.filter(s => s.status === 'connected');
  const totalToolsCount = connectedServers.reduce((acc, s) => acc + s.tools.length, 0);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = createNewConversation();
    }

    addMessage(convId, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now()
    });

    const userPrompt = input;
    setInput('');
    setIsLoading(true);

    try {
      // Deterministic routing without LLM
      const calcMatch = userPrompt.trim().match(/^Calculate\s+(.+)$/i) || userPrompt.trim().match(/^([\d\s\+\-\*\/\(\)\.\^]+)$/i);
      const emailMatch = userPrompt.trim().match(/^Email\s+to:\s+(.+?)\s+subject:\s+(.+?)\s+body:\s+(.+)$/i);
      const readEmailsMatch = userPrompt.trim().match(/^Read emails$/i);
      const searchMatch = userPrompt.trim().match(/^Search documents\s+(.+)$/i);

      if (calcMatch) {
        const calcServer = mcpServers.find(s => s.id === 'server-calc');
        if (!calcServer || calcServer.status !== 'connected') {
          throw new Error('Calculator MCP server is not connected. Please connect it first.');
        }

        const expression = calcMatch[1].trim();
        const response = await calculateExpression(expression);

        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response.success ? `${expression} = **${response.result}**` : `Unable to calculate:\n${response.error}`,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'calculator',
            toolName: 'evaluate',
            status: response.success ? 'completed' : 'failed',
            arguments: { expression },
            result: response.result,
            error: response.error
          }]
        });
      } else if (emailMatch) {
        const emailServer = mcpServers.find(s => s.id === 'server-email');
        if (!emailServer || emailServer.status !== 'connected') {
          throw new Error('Email MCP server is not connected. Please connect it first.');
        }

        const to = emailMatch[1].trim();
        const subject = emailMatch[2].trim();
        const body = emailMatch[3].trim();

        const response = await sendMockEmail(to, subject, body);

        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response.success ? `**MOCK EMAIL ACCEPTED**\nTo: ${to}\nSubject: ${subject}\n\n${body}` : `Failed to send email:\n${response.error}`,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'email',
            toolName: 'send',
            status: response.success ? 'completed' : 'failed',
            arguments: { to, subject, body },
            result: response.result,
            error: response.error
          }]
        });
      } else if (readEmailsMatch) {
        const emailServer = mcpServers.find(s => s.id === 'server-email');
        if (!emailServer || emailServer.status !== 'connected') {
          throw new Error('Email MCP server is not connected. Please connect it first.');
        }

        const response = await readMockEmails();
        let content = '';
        if (response.success && response.result) {
          try {
            const parsed = JSON.parse(response.result);
            if (parsed.emails && Array.isArray(parsed.emails)) {
              content = '**UNREAD EMAILS**\n\n' + parsed.emails.map((e: any) =>
                `**From:** ${e.sender}\n**Subject:** ${e.subject}\n**Time:** ${e.timestamp}\n**Body:** ${e.body}`
              ).join('\n\n---\n\n');
            } else {
              content = "Could not parse emails.";
            }
          } catch (e) {
            content = "Failed to parse result: " + response.result;
          }
        } else {
          content = `Failed to read emails:\n${response.error}`;
        }

        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'email',
            toolName: 'read',
            status: response.success ? 'completed' : 'failed',
            arguments: {},
            result: response.result,
            error: response.error
          }]
        });
      } else if (searchMatch) {
        const searchServer = mcpServers.find(s => s.id === 'server-docsearch');
        if (!searchServer || searchServer.status !== 'connected') {
          throw new Error('Document Search MCP server is not connected. Please connect it first.');
        }

        const query = searchMatch[1].trim();
        const response = await searchDocuments(query);

        let displayContent = '';
        if (response.success) {
          displayContent = `**SEARCH RESULTS**\n\n${response.result}`;
        } else {
          displayContent = `Failed to search documents:\n${response.error}`;
          if (response.injectionBlocked) {
            displayContent = `🚨 **SECURITY BLOCK** 🚨\n\n${response.error}`;
          }
        }

        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: displayContent,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'documentsearch',
            toolName: 'search_documents',
            status: response.success ? 'completed' : 'failed',
            arguments: { query },
            result: response.result,
            error: response.error
          }]
        });
      } else {
        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "I am running in deterministic mode without an LLM.\n\nCalculator Example: 'Calculate 25 * 4'\nEmail Example: 'Email to: test@example.com subject: Hello body: This is a test'\nRead Emails Example: 'Read emails'\nDoc Search Example: 'Search documents Q3 report'",
          timestamp: Date.now()
        });
      }

    } catch (error: any) {
      addMessage(convId, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong.'}`,
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '780px', margin: '0 auto 24px auto', padding: '0 24px' }}>
      <div
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-md)',
          position: 'relative'
        }}
      >
        {/* Text Input area */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything..."
          style={{
            width: '100%',
            minHeight: '64px',
            maxHeight: '180px',
            padding: '16px 20px',
            border: 'none',
            background: 'transparent',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '0.925rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5
          }}
        />

        {/* Toolbar */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center" style={{ gap: '6px' }}>
            {/* Attachment Button */}
            <button className="btn-icon" title="Attach file">
              <Paperclip size={16} />
            </button>

            {/* Tools Control Button & Popover */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn"
                style={{
                  background: showToolsPopover ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  border: 'none',
                  padding: '5px 9px',
                  gap: '6px',
                  borderRadius: 'var(--radius-sm)'
                }}
                onClick={() => setShowToolsPopover(!showToolsPopover)}
              >
                <Wrench size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Tools {connectedServers.length > 0 ? `· ${connectedServers.length} connected` : ''}
                </span>
              </button>

              {/* Connected Tools Popover */}
              {showToolsPopover && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '8px',
                    width: '280px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border-medium)',
                    padding: '12px',
                    zIndex: 30
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                    <span className="text-xs font-medium text-tertiary uppercase" style={{ letterSpacing: '0.05em' }}>
                      Connected Tools
                    </span>
                    <span className="text-xs text-tertiary">{totalToolsCount} tools</span>
                  </div>

                  <div className="flex flex-col" style={{ gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {connectedServers.length === 0 ? (
                      <div className="text-xs text-tertiary" style={{ padding: '8px 0', textAlign: 'center' }}>
                        No MCP servers connected
                      </div>
                    ) : (
                      connectedServers.map(server => (
                        <div
                          key={server.id}
                          style={{
                            padding: '8px 10px',
                            background: 'var(--bg-app)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                            <div className="flex items-center" style={{ gap: '6px' }}>
                              <span className="status-dot status-connected"></span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {server.name}
                              </span>
                            </div>
                            <span className="text-xs text-tertiary">{server.tools.length} tools</span>
                          </div>

                          <div className="flex flex-col" style={{ gap: '2px', paddingLeft: '13px' }}>
                            {server.tools.map(t => (
                              <div key={t.name} className="flex items-center" style={{ gap: '6px' }}>
                                <ShieldCheck size={11} style={{ color: 'var(--sentinel-trusted)' }} />
                                <span className="text-xs text-secondary">{t.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setShowToolsPopover(false);
                      setConnectModalOpen(true);
                    }}
                    className="btn w-full"
                    style={{
                      marginTop: '10px',
                      padding: '6px',
                      fontSize: '0.775rem',
                      justifyContent: 'center',
                      borderStyle: 'dashed'
                    }}
                  >
                    <Plus size={13} /> Connect MCP Server
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              background: (input.trim() && !isLoading) ? 'var(--text-primary)' : 'var(--border-medium)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (input.trim() && !isLoading) ? 'pointer' : 'default',
              transition: 'all 0.18s ease'
            }}
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowUp size={15} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
