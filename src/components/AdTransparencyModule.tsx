import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { AdTargeting } from '../db/models';
import { Target, Users, Search, ShieldCheck } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <div className="w-10 h-10 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin mb-4" />
        <p className="text-ink-500 text-sm font-medium">{t('ads.loading')}</p>
      </div>
    );
  }

  const getAggregatedData = () => {
    let interests: string[] = [];
    let advertisers: string[] = [];

    adData.forEach(item => {
      if (selectedPlatform === 'all' || item.platform === selectedPlatform) {
        interests = [...interests, ...item.interests];
        advertisers = [...advertisers, ...item.advertisers];
      }
    });

    return {
      interests: Array.from(new Set(interests)).sort(),
      advertisers: Array.from(new Set(advertisers)).sort()
    };
  };

  const { interests, advertisers } = getAggregatedData();

  const filteredInterests = interests.filter(i =>
    i.toLowerCase().includes(interestSearch.toLowerCase())
  );

  const filteredAdvertisers = advertisers.filter(a =>
    a.toLowerCase().includes(advertiserSearch.toLowerCase())
  );

  const segmentBtn = (active: boolean, variant: 'default' | 'facebook' | 'instagram' = 'default') => {
    if (!active) return 'px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors text-ink-500 hover:text-ink-900';
    if (variant === 'facebook') return 'px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors bg-blue-600 text-white';
    if (variant === 'instagram') {
      return 'px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white';
    }
    return 'px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors bg-ink-950 text-brand-50';
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 max-w-6xl mx-auto h-[calc(100dvh-3.5rem-3.5rem-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <div className="mc-surface-ink px-4 py-5 sm:px-6 sm:py-6 shrink-0 rounded-md">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 border border-ink-600 mc-text-on-ink-accent text-[10px] font-semibold uppercase tracking-[0.18em]">
            {t('ads.badge')}
          </span>
          <div className="flex items-center gap-1 mc-text-on-ink-muted text-xs font-semibold">
            <ShieldCheck size={14} className="text-brand-400" />
            <span>{t('ads.offline')}</span>
          </div>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] mc-text-on-ink">
          {t('ads.title')}
        </h1>
        <p className="mt-2 mc-text-on-ink-muted text-sm max-w-3xl leading-relaxed">
          {t('ads.body')}
        </p>
      </div>

      <div className="flex border border-ink-200 bg-white self-stretch sm:self-start shrink-0 overflow-x-auto">
        <button onClick={() => setSelectedPlatform('all')} className={segmentBtn(selectedPlatform === 'all')}>
          {t('ads.platform.all')}
        </button>
        <button onClick={() => setSelectedPlatform('facebook')} className={segmentBtn(selectedPlatform === 'facebook', 'facebook')}>
          Facebook
        </button>
        <button onClick={() => setSelectedPlatform('instagram')} className={segmentBtn(selectedPlatform === 'instagram', 'instagram')}>
          Instagram
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        <div className="bg-white border border-ink-200 rounded-md p-5 flex flex-col h-full overflow-hidden">
          <div className="mb-4 shrink-0">
            <div className="flex items-center gap-2 text-brand-600 mb-1">
              <Target size={18} />
              <h3 className="font-display text-lg font-semibold text-ink-950">{t('ads.interestsTitle', { count: interests.length })}</h3>
            </div>
            <p className="text-xs text-ink-400">{t('ads.interestsSubtitle')}</p>
          </div>

          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
            <input
              type="text"
              placeholder={t('ads.interestsFilter')}
              value={interestSearch}
              onChange={(e) => setInterestSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md bg-ink-50 border border-ink-200 focus:border-brand-500 text-xs font-medium outline-none transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {filteredInterests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredInterests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2.5 py-1 border border-ink-200 text-ink-700 text-xs font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Target size={28} className="text-ink-300 mx-auto mb-2" />
                <p className="text-ink-400 text-xs font-medium">{t('ads.interestsEmpty')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink-200 rounded-md p-5 flex flex-col h-full overflow-hidden">
          <div className="mb-4 shrink-0">
            <div className="flex items-center gap-2 text-ink-700 mb-1">
              <Users size={18} />
              <h3 className="font-display text-lg font-semibold text-ink-950">{t('ads.advertisersTitle', { count: advertisers.length })}</h3>
            </div>
            <p className="text-xs text-ink-400">{t('ads.advertisersSubtitle')}</p>
          </div>

          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
            <input
              type="text"
              placeholder={t('ads.advertisersFilter')}
              value={advertiserSearch}
              onChange={(e) => setAdvertiserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md bg-ink-50 border border-ink-200 focus:border-brand-500 text-xs font-medium outline-none transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 divide-y divide-ink-100">
            {filteredAdvertisers.length > 0 ? (
              filteredAdvertisers.map((advertiser, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-ink-800 truncate">{advertiser}</span>
                  <span className="px-2 py-0.5 border border-ink-200 text-ink-500 text-[9px] font-semibold uppercase tracking-wider shrink-0">
                    {t('ads.directTargeting')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Users size={28} className="text-ink-300 mx-auto mb-2" />
                <p className="text-ink-400 text-xs font-medium">{t('ads.advertisersEmpty')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
