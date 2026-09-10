import { create } from 'zustand';
import type {
  Conversation, McpServer, Message,
  TrustRegistryData, AuditLogEntry, ServerVerificationResult,
  AttackScenario
} from '../types';
import * as api from '../services/chat-api';

interface AppState {
  // Connections
  mcpServers: McpServer[];
  addServer: (server: Omit<McpServer, 'id' | 'status' | 'tools'>) => void;
  removeServer: (id: string) => void;
  updateServerStatus: (id: string, status: McpServer['status'], tools?: any[]) => void;
  selectedServerId: string | null;
  setSelectedServerId: (id: string | null) => void;
  isConnectModalOpen: boolean;
  setConnectModalOpen: (isOpen: boolean) => void;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateConversationHistory: (conversationId: string, backendHistory: any[]) => void;
  createNewConversation: () => string;

  // Sentinel Security
  trustRegistry: TrustRegistryData | null;
  auditLog: AuditLogEntry[];
  activeSimulation: string | null;
  scenarios: AttackScenario[];
  lastVerification: ServerVerificationResult | null;
  isTrustPanelOpen: boolean;
  isAuditPanelOpen: boolean;
  isSimulatorOpen: boolean;
  pendingApproval: ServerVerificationResult | null;
  mutationAlert: ServerVerificationResult | null;
  codeMutationAlert: any | null;
  
  // Live Analysis
  isLiveAnalysisOpen: boolean;
  setLiveAnalysisOpen: (open: boolean) => void;
  liveAnalysisServerId: string | null;
  setLiveAnalysisServerId: (id: string | null) => void;

  // Sentinel Actions
  setTrustPanelOpen: (open: boolean) => void;
  setAuditPanelOpen: (open: boolean) => void;
  setSimulatorOpen: (open: boolean) => void;
  setPendingApproval: (verification: ServerVerificationResult | null) => void;
  setMutationAlert: (verification: ServerVerificationResult | null) => void;
  setCodeMutationAlert: (data: any | null) => void;
  fetchSentinelStatus: () => Promise<void>;
  fetchAuditLog: () => Promise<void>;
  fetchScenarios: () => Promise<void>;
  approveServer: (serverId: string) => Promise<void>;
  approveToolUpdate: (serverId: string, toolName: string) => Promise<void>;
  rejectToolUpdate: (serverId: string, toolName: string) => Promise<void>;
  reverifyServer: (serverId: string) => Promise<void>;
  simulateAttack: (scenarioId: string) => Promise<void>;
  resetSimulation: () => Promise<void>;
}

// Initial mock data
const initialServers: McpServer[] = [
  {
    id: 'server-calc',
    name: 'Calculator',
    status: 'disconnected',
    type: 'local',
    command: 'node ./servers/calculator/index.js',
    tools: []
  },
  {
    id: 'server-email',
    name: 'Email',
    status: 'disconnected',
    type: 'local',
    command: 'node ./servers/email/index.js',
    tools: []
  },
  {
    id: 'server-calcmcp2',
    name: 'CalculatorMCP2',
    status: 'disconnected',
    type: 'local',
    command: 'node ./servers/calculatormcp2-server/index.js',
    tools: []
  },
  {
    id: 'server-docsearch',
    name: 'Document Search',
    status: 'disconnected',
    type: 'local',
    command: 'node ./servers/document-search-server/index.js',
    tools: []
  }
];

const SERVER_MAP: Record<string, string> = {
  'server-calc': 'calculator',
  'server-email': 'email',
  'server-calcmcp2': 'calculatormcp2',
  'server-docsearch': 'documentsearch'
};

export const useStore = create<AppState>((set, get) => ({
  // Connections
  mcpServers: initialServers,
  addServer: (serverData) => set((state) => {
    const newServer: McpServer = {
      ...serverData,
      id: `server-${Date.now()}`,
      status: 'connecting',
      tools: []
    };

    setTimeout(() => {
      set((s) => ({
        mcpServers: s.mcpServers.map(srv =>
          srv.id === newServer.id ? {
            ...srv,
            status: 'connected',
            tools: [{ name: 'test_tool', description: 'A discovered tool' }]
          } : srv
        )
      }));
    }, 1500);

    return { mcpServers: [...state.mcpServers, newServer] };
  }),
  removeServer: (id) => set((state) => ({
    mcpServers: state.mcpServers.filter(s => s.id !== id),
    selectedServerId: state.selectedServerId === id ? null : state.selectedServerId
  })),
  updateServerStatus: (id, status, tools) => set((state) => ({
    mcpServers: state.mcpServers.map(s => s.id === id ? { ...s, status, tools: tools || s.tools } : s)
  })),
  selectedServerId: null,
  setSelectedServerId: (id) => set({ selectedServerId: id }),
  isConnectModalOpen: false,
  setConnectModalOpen: (isOpen) => set({ isConnectModalOpen: isOpen }),

  // Live Analysis
  isLiveAnalysisOpen: false,
  setLiveAnalysisOpen: (isOpen) => set({ isLiveAnalysisOpen: isOpen }),
  liveAnalysisServerId: null,
  setLiveAnalysisServerId: (id) => set({ liveAnalysisServerId: id }),

  // Conversations
  conversations: [],
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  addMessage: (conversationId, message) => set((state) => ({
    conversations: state.conversations.map(c =>
      c.id === conversationId ? {
        ...c,
        messages: [...c.messages, message],
        updatedAt: Date.now()
      } : c
    )
  })),
  updateConversationHistory: (conversationId, backendHistory) => set((state) => ({
    conversations: state.conversations.map(c =>
      c.id === conversationId ? { ...c, backendHistory } : c
    )
  })),
  createNewConversation: () => {
    const id = `conv-${Date.now()}`;
    set((state) => {
      const newConv: Conversation = {
        id,
        title: 'New Conversation',
        updatedAt: Date.now(),
        messages: [],
        enabledMcpServerIds: state.mcpServers.filter(s => s.status === 'connected').map(s => s.id)
      };
      return {
        conversations: [newConv, ...state.conversations],
        activeConversationId: newConv.id
      };
    });
    return id;
  },

  // ─── Sentinel Security State ──────────────────────────────────

  trustRegistry: null,
  auditLog: [],
  activeSimulation: null,
  scenarios: [],
  lastVerification: null,
  isTrustPanelOpen: false,
  isAuditPanelOpen: false,
  isSimulatorOpen: false,
  pendingApproval: null,
  mutationAlert: null,
  codeMutationAlert: null,

  setTrustPanelOpen: (open) => set({ isTrustPanelOpen: open }),
  setAuditPanelOpen: (open) => set({ isAuditPanelOpen: open }),
  setSimulatorOpen: (open) => set({ isSimulatorOpen: open }),
  setPendingApproval: (verification) => set({ pendingApproval: verification }),
  setMutationAlert: (verification) => set({ mutationAlert: verification }),
  setCodeMutationAlert: (data) => set({ codeMutationAlert: data }),

  fetchSentinelStatus: async () => {
    try {
      const data = await api.getSentinelStatus();
      set({
        trustRegistry: data.registry,
        activeSimulation: data.activeScenario
      });
    } catch (e) {
      console.error('Failed to fetch sentinel status:', e);
    }
  },

  fetchAuditLog: async () => {
    try {
      const data = await api.getAuditLog();
      set({ auditLog: data.entries });
    } catch (e) {
      console.error('Failed to fetch audit log:', e);
    }
  },

  fetchScenarios: async () => {
    try {
      const data = await api.getScenarios();
      set({ scenarios: data.scenarios });
    } catch (e) {
      console.error('Failed to fetch scenarios:', e);
    }
  },

  approveServer: async (serverId: string) => {
    try {
      const sentinelId = SERVER_MAP[serverId] || serverId;
      const data = await api.approveServer(sentinelId);
      set({
        trustRegistry: data.registry,
        pendingApproval: null
      });
      // Refresh audit log
      get().fetchAuditLog();
    } catch (e) {
      console.error('Failed to approve server:', e);
    }
  },

  approveToolUpdate: async (serverId: string, toolName: string) => {
    try {
      const data = await api.approveToolUpdate(serverId, toolName);
      set({
        trustRegistry: data.registry,
        mutationAlert: null
      });
      get().fetchAuditLog();
    } catch (e) {
      console.error('Failed to approve tool update:', e);
    }
  },

  rejectToolUpdate: async (serverId: string, toolName: string) => {
    try {
      const data = await api.rejectToolUpdate(serverId, toolName);
      set({
        trustRegistry: data.registry,
        mutationAlert: null
      });
      get().fetchAuditLog();
    } catch (e) {
      console.error('Failed to reject tool update:', e);
    }
  },

  reverifyServer: async (serverId: string) => {
    try {
      const data = await api.reverifyServer(serverId);
      set({
        trustRegistry: data.registry,
        lastVerification: data.verification
      });

      // Check if mutation detected
      if (data.verification.overallStatus === 'mutation_detected') {
        set({ mutationAlert: data.verification });
      }

      get().fetchAuditLog();
    } catch (e) {
      console.error('Failed to re-verify server:', e);
    }
  },

  simulateAttack: async (scenarioId: string) => {
    try {
      const data = await api.simulateAttack(scenarioId);
      set({
        activeSimulation: scenarioId,
        trustRegistry: data.registry,
        lastVerification: data.verification
      });

      if (data.verification?.overallStatus === 'mutation_detected') {
        set({ mutationAlert: data.verification });
      }

      get().fetchAuditLog();
    } catch (e) {
      console.error('Failed to simulate attack:', e);
    }
  },

  resetSimulation: async () => {
    try {
      const data = await api.resetSimulation();
      set({
        activeSimulation: null,
        trustRegistry: data.registry,
        lastVerification: null,
        mutationAlert: null
      });
      get().fetchAuditLog();
    } catch (e) {
      console.error('Failed to reset simulation:', e);
    }
  }
}));
