import React from 'react';
import { ArchiveProvider, useArchive } from './context/ArchiveContext';
import { ImportScreen } from './components/ImportScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardModule } from './components/DashboardModule';
import { MessagingModule } from './components/MessagingModule';
import { GalleryModule } from './components/GalleryModule';
import { AdTransparencyModule } from './components/AdTransparencyModule';
import { SettingsModule } from './components/SettingsModule';

const AppContent: React.FC = () => {
  const { activeTab, stats } = useArchive();

  // If no archive is loaded and we are on the import tab, show the import screen
  if (activeTab === 'import' || !stats) {
    return <ImportScreen />;
  }

  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardModule />;
      case 'messages':
        return <MessagingModule />;
      case 'gallery':
        return <GalleryModule />;
      case 'ads':
        return <AdTransparencyModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Module Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <ArchiveProvider>
      <AppContent />
    </ArchiveProvider>
  );
}

export default App;
