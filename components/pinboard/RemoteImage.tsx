'use client';

import { CSSProperties, ImgHTMLAttributes, useEffect, useMemo, useState } from 'react';
import { directImageUrl, isAppServedImage, isHttpImageUrl, proxiedImageUrl } from '@/lib/remote-image';

type RemoteImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | null | undefined;
  pageUrl?: string | null;
  onBroken?: () => void;
  hideUntilLoaded?: boolean;
};

export function RemoteImage({ src, pageUrl, onBroken, hideUntilLoaded = false, style, onLoad, onError, ...props }: RemoteImageProps) {
  const [attempt, setAttempt] = useState<'proxy' | 'direct' | 'failed'>('proxy');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAttempt('proxy');
    setLoaded(false);
  }, [src, pageUrl]);

  const candidates = useMemo(() => {
    const original = directImageUrl(src || '');
    if (!original) return [];
    const proxied = proxiedImageUrl(original, pageUrl);
    const list = [proxied];
    if (isHttpImageUrl(original) && !isAppServedImage(original) && original !== proxied) list.push(original);
    return Array.from(new Set(list.filter(Boolean)));
  }, [src, pageUrl]);

  if (!candidates.length || attempt === 'failed') return null;
  const currentSrc = attempt === 'direct' ? candidates[1] : candidates[0];
  if (!currentSrc) return null;

  const baseStyle = (style || {}) as CSSProperties;
  const loadedOpacity = baseStyle.opacity ?? 1;
  const mergedStyle: CSSProperties | undefined = hideUntilLoaded
    ? { ...baseStyle, opacity: loaded ? loadedOpacity : 0 }
    : baseStyle;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={currentSrc}
      referrerPolicy="no-referrer"
      style={mergedStyle}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        if (attempt === 'proxy' && candidates[1]) {
          setAttempt('direct');
          setLoaded(false);
          return;
        }
        setAttempt('failed');
        onBroken?.();
        onError?.(event);
      }}
    />
  );
}
