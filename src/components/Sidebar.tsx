import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { LayoutDashboard, MessageSquare, Image, Award, Settings, LogOut, Package } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, resetArchive, stats } = useArchive();

  const menuItems = [
    { id: 'dashboard', label: 'Synthèse', icon: LayoutDashboard },
    { id: 'messages', label: 'Messagerie', icon: MessageSquare },
    { id: 'gallery', label: 'Galerie', icon: Image },
    { id: 'ads', label: 'Publicité', icon: Award },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Logo */}
      <div className="p-6 border-b border-slate-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
          <Package size={22} />
        </div>
        <div>
          <h1 className="font-extrabold text-brand-950 text-lg leading-none">Meta-Capsule</h1>
          <span className="text-xs text-slate-400 font-medium">v1.0.0 (MVP)</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Quick Info & Reset */}
      <div className="p-4 border-t border-slate-50 space-y-4">
        {stats && (
          <div className="px-4 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-400 font-medium leading-none mb-1">Archive de</p>
            <p className="font-bold text-slate-800 text-sm truncate">{stats.ownerName || 'Utilisateur'}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
              {stats.platform}
            </span>
          </div>
        )}

        <button
          onClick={resetArchive}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut size={18} />
          Fermer l'archive
        </button>
      </div>
    </aside>
  );
};
