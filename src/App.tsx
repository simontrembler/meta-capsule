import React from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
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
  const { activeTab, stats, isRestoringSession } = useArchive();
  const { t } = useLanguage();

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">{t('app.restoring')}</p>
      </div>
    );
  }

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
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-slate-50">
          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <ArchiveProvider>
        <AppContent />
      </ArchiveProvider>
    </LanguageProvider>
  );
}

export default App;
