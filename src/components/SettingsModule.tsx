import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { Trash2, Database, ShieldAlert } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { resetArchive } = useArchive();

  return (
    <div className="p-8 max-w-4xl space-y-6">
      {/* Privacy Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 text-brand-700">
          <ShieldAlert size={22} />
          <h3 className="text-lg font-bold text-slate-800">Sécurité et Confidentialité</h3>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          Meta-Capsule est conçu pour garantir une confidentialité absolue. Toutes vos données sont stockées localement dans la base de données <strong>IndexedDB</strong> de votre navigateur et ne sont jamais transmises à un serveur externe.
        </p>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-1">
          <p>• <strong>Emplacement de stockage :</strong> IndexedDB (Local)</p>
          <p>• <strong>Accès archive ZIP :</strong> File System Access API (Chrome/Edge) — handle persisté, sans recopier le fichier</p>
          <p>• <strong>Télémétrie :</strong> Désactivée</p>
          <p>• <strong>Accès Internet :</strong> Non requis (l'application fonctionne hors-ligne)</p>
        </div>
      </div>

      {/* Database Management */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 text-slate-700">
          <Database size={22} />
          <h3 className="text-lg font-bold text-slate-800">Gestion des Données Locales</h3>
        </div>
        <p className="text-slate-600 text-sm">
          Vous pouvez à tout moment supprimer l'intégralité des données importées de votre navigateur. Cette action est irréversible.
        </p>

        <div className="pt-2">
          <button
            onClick={resetArchive}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-semibold text-sm transition-colors"
          >
            <Trash2 size={16} />
            Supprimer toutes les données locales
          </button>
        </div>
      </div>
    </div>
  );
};
