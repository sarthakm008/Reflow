// CommitZero - Root Application Component
// Pure JavaScript, responsive layout, collegiate productivity theme

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Navbar from './components/common/Navbar.jsx';
import Sidebar from './components/common/Sidebar.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import TaskManagerView from './components/tasks/TaskManagerView.jsx';
import PlannerView from './components/planner/PlannerView.jsx';
import FocusWorkspaceView from './components/focus/FocusWorkspaceView.jsx';
import PlanRecoveryView from './components/recovery/PlanRecoveryView.jsx';
import AnalyticsView from './components/analytics/AnalyticsView.jsx';
import TaskFormModal from './components/tasks/TaskFormModal.jsx';

function AppContent() {
  const { currentView } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onOpenNewTaskModal={() => setIsGlobalTaskModalOpen(true)} />;
      case 'tasks':
        return <TaskManagerView />;
      case 'planner':
        return <PlannerView />;
      case 'focus':
        return <FocusWorkspaceView />;
      case 'recovery':
        return <PlanRecoveryView />;
      case 'analytics':
        return <AnalyticsView />;
      default:
        return <DashboardView onOpenNewTaskModal={() => setIsGlobalTaskModalOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Top Navbar */}
      <Navbar
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Task Creation Modal */}
      <TaskFormModal
        isOpen={isGlobalTaskModalOpen}
        onClose={() => setIsGlobalTaskModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
