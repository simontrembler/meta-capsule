import React from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ArchiveProvider, useArchive } from './context/ArchiveContext';
import { ShellProvider } from './context/ShellContext';
import { ImportScreen } from './components/ImportScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardModule } from './components/DashboardModule';
import { MessagingModule } from './components/MessagingModule';
import { GalleryModule } from './components/GalleryModule';
import { AdTransparencyModule } from './components/AdTransparencyModule';
import { SettingsModule } from './components/SettingsModule';
import { IngestOverlay } from './components/IngestOverlay';

const AppContent: React.FC = () => {
  const {
    activeTab,
    stats,
    isRestoringSession,
    isIngesting,
    ingestionProgress,
    ingestionStatusText
  } = useArchive();
  const { t } = useLanguage();

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink-50 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin" />
        <p className="text-sm text-ink-500 font-medium">{t('app.restoring')}</p>
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
    <ShellProvider>
      <div className="flex h-[100dvh] bg-ink-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-auto bg-ink-50">
            {renderActiveModule()}
          </main>
        </div>
        {isIngesting && (
          <IngestOverlay
            progress={ingestionProgress}
            statusText={ingestionStatusText}
            title={t('archives.ingestTitle')}
            hint={t('archives.ingestHint')}
          />
        )}
      </div>
    </ShellProvider>
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
