import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import RightPanel from './components/RightPanel';
import ConnectMCPModal from './components/ConnectMCPModal';
import TrustRegistryPanel from './components/TrustRegistryPanel';
import AuditLogPanel from './components/AuditLogPanel';
import AttackSimulator from './components/AttackSimulator';
import ApprovalFlow from './components/ApprovalFlow';
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
      <Sidebar />
      <ChatArea />
      {selectedServer && <RightPanel server={selectedServer} />}
      {isConnectModalOpen && <ConnectMCPModal />}

      {/* Sentinel Security Modals */}
      <TrustRegistryPanel />
      <AuditLogPanel />
      <AttackSimulator />

      {/* Approval Flow — shown when a server is first discovered */}
      {pendingApproval && (
        <ApprovalFlow
          verification={pendingApproval}
          onClose={() => setPendingApproval(null)}
        />
      )}

      <LiveAnalysisModal />

      {/* Mutation Alert — shown when integrity violation detected */}
      {mutationAlert && <MutationAlertModal />}

      {/* Code Mutation Alert — True Zero-Trust */}
      <CodeMutationAlertModal />
    </div>
  );
}

export default App;
