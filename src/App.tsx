import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import RightPanel from './components/RightPanel';
import ConnectMCPModal from './components/ConnectMCPModal';
import TrustRegistryPanel from './components/TrustRegistryPanel';
import AuditLogPanel from './components/AuditLogPanel';
import AttackSimulator from './components/AttackSimulator';
import ApprovalFlow from './components/ApprovalFlow';
import MutationAlertModal from './components/MutationAlertModal';
import CodeMutationAlertModal from './components/CodeMutationAlertModal';
import LiveAnalysisModal from './components/LiveAnalysisModal';

function App() {
  const {
    selectedServerId, isConnectModalOpen, mcpServers,
    pendingApproval, setPendingApproval,
    mutationAlert
  } = useStore();
  const selectedServer = mcpServers.find(s => s.id === selectedServerId);

  return (
    <div className="app-container">
      {/* Zone 1: Left Navigation Sidebar (~240px) */}
      <Sidebar />

      {/* Zone 2: Center Main Workspace (Effortless AI Chat) */}
      <ChatArea />

      {/* Zone 3: Right Contextual Inspector (Professional Utility Panel) */}
      {selectedServer && <RightPanel server={selectedServer} />}

      {/* Modals & Dialogs */}
      {isConnectModalOpen && <ConnectMCPModal />}
      <TrustRegistryPanel />
      <AuditLogPanel />
      <AttackSimulator />

      {/* Approval Flow — Discovery review */}
      {pendingApproval && (
        <ApprovalFlow
          verification={pendingApproval}
          onClose={() => setPendingApproval(null)}
        />
      )}

      <LiveAnalysisModal />

      {/* Manifest Integrity Review — Sentinel Signature interaction */}
      {mutationAlert && <MutationAlertModal />}

      {/* True Zero-Trust Code Mutation Alert */}
      <CodeMutationAlertModal />
    </div>
  );
}

export default App;
