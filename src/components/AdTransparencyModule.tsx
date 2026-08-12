import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { AdTargeting } from '../db/models';
import { Target, Users, Search, Sparkles, ShieldCheck } from 'lucide-react';

export const AdTransparencyModule: React.FC = () => {
  const { t } = useLanguage();
  const [adData, setAdData] = useState<AdTargeting[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'facebook' | 'instagram'>('all');
  const [interestSearch, setInterestSearch] = useState('');
  const [advertiserSearch, setAdvertiserSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAdData = async () => {
      setIsLoading(true);
      try {
        const data = await db.adTargeting.toArray();
        setAdData(data);
      } catch (err) {
        console.error('Error loading ad targeting data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAdData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-5rem)]">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-600 animate-spin mb-4"></div>
        <p className="text-slate-500 text-sm font-medium">{t('ads.loading')}</p>
      </div>
    );
  }

  // Aggregate interests and advertisers across platforms based on filter
  const getAggregatedData = () => {
    let interests: string[] = [];
    let advertisers: string[] = [];

    adData.forEach(item => {
      if (selectedPlatform === 'all' || item.platform === selectedPlatform) {
        interests = [...interests, ...item.interests];
        advertisers = [...advertisers, ...item.advertisers];
      }
    });

    // De-duplicate
    return {
      interests: Array.from(new Set(interests)).sort(),
      advertisers: Array.from(new Set(advertisers)).sort()
    };
  };

  const { interests, advertisers } = getAggregatedData();

  // Filtered lists based on search inputs
  const filteredInterests = interests.filter(i =>
    i.toLowerCase().includes(interestSearch.toLowerCase())
  );

  const filteredAdvertisers = advertisers.filter(a =>
    a.toLowerCase().includes(advertiserSearch.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto h-[calc(100vh-5rem)] flex flex-col overflow-hidden">
      
      {/* Educational Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-5 pointer-events-none">
          <Target size={200} />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-500 text-white text-xs font-bold uppercase tracking-wider">
              {t('ads.badge')}
            </span>
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
              <ShieldCheck size={14} />
              <span>{t('ads.offline')}</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t('ads.title')}
          </h1>
          <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
            {t('ads.body')}
          </p>
        </div>
      </div>

      {/* Platform Selector */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm shrink-0 self-start">
        <button
          onClick={() => setSelectedPlatform('all')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
            selectedPlatform === 'all'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('ads.platform.all')}
        </button>
        <button
          onClick={() => setSelectedPlatform('facebook')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
            selectedPlatform === 'facebook'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Facebook
        </button>
        <button
          onClick={() => setSelectedPlatform('instagram')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
            selectedPlatform === 'instagram'
              ? 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Instagram
        </button>
      </div>

      {/* Main Content Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
        
        {/* Interests Section */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-brand-600 mb-1">
                <Target size={20} />
                <h3 className="text-lg font-bold text-slate-800">{t('ads.interestsTitle', { count: interests.length })}</h3>
              </div>
              <p className="text-xs text-slate-400">{t('ads.interestsSubtitle')}</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={t('ads.interestsFilter')}
              value={interestSearch}
              onChange={(e) => setInterestSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-brand-300 focus:bg-white text-xs font-semibold outline-none transition-all"
            />
          </div>

          {/* Interests Badges Grid */}
          <div className="flex-1 overflow-y-auto pr-2">
            {filteredInterests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredInterests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-100/50 text-brand-800 text-xs font-bold shadow-sm"
                  >
                    <Sparkles size={10} className="text-brand-500 shrink-0" />
                    <span>{interest}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Target size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-semibold">{t('ads.interestsEmpty')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Advertisers Section */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-slate-700 mb-1">
                <Users size={20} />
                <h3 className="text-lg font-bold text-slate-800">{t('ads.advertisersTitle', { count: advertisers.length })}</h3>
              </div>
              <p className="text-xs text-slate-400">{t('ads.advertisersSubtitle')}</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={t('ads.advertisersFilter')}
              value={advertiserSearch}
              onChange={(e) => setAdvertiserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-brand-300 focus:bg-white text-xs font-semibold outline-none transition-all"
            />
          </div>

          {/* Advertisers List */}
          <div className="flex-1 overflow-y-auto pr-2 divide-y divide-slate-50">
            {filteredAdvertisers.length > 0 ? (
              filteredAdvertisers.map((advertiser, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-700 truncate">{advertiser}</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider shrink-0">
                    {t('ads.directTargeting')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Users size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-semibold">{t('ads.advertisersEmpty')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
