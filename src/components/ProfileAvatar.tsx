import React, { useEffect, useState } from 'react';
import { getMediaBlobUrl } from '../utils/zipMediaResolver';

interface ProfileAvatarProps {
  name: string;
  relativePath?: string | null;
  zipFile: File | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-xl'
};

/**
 * Shows the archive profile photo from the local ZIP when available,
 * otherwise falls back to the name initial.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  name,
  relativePath,
  zipFile,
  size = 'md',
  className = ''
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!zipFile || !relativePath) {
        setBlobUrl(null);
        return;
      }

      try {
        const url = await getMediaBlobUrl(zipFile, relativePath);
        if (!cancelled) setBlobUrl(url);
      } catch (err) {
        console.warn('Unable to load profile photo from archive:', err);
        if (!cancelled) setBlobUrl(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [relativePath, zipFile]);

  const initial = (name || '?').charAt(0).toUpperCase();

  if (blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 border border-brand-100 shadow-sm ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
};
