'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface VariantMedia {
  /** Image the picker wants shown, or null for "leave the gallery alone". */
  activeUrl: string | null;
  showImage: (url: string | null) => void;
}

/**
 * Links the variant picker to the gallery.
 *
 * On the supplier's own page, choosing a colour swaps the main photo, and a
 * shopper who has used one expects the same here. The two components sit in
 * different columns of the product grid — and the page itself is a server
 * component — so the shared state lives in a context that wraps the grid
 * rather than being lifted into a client rewrite of the whole page.
 *
 * The default value is a working no-op, so ProductGallery and AddToCart still
 * render correctly anywhere this provider is absent.
 */
const VariantMediaContext = createContext<VariantMedia>({
  activeUrl: null,
  showImage: () => {},
});

export function VariantMediaProvider({ children }: { children: ReactNode }) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const showImage = useCallback((url: string | null) => setActiveUrl(url), []);
  const value = useMemo(() => ({ activeUrl, showImage }), [activeUrl, showImage]);

  return <VariantMediaContext.Provider value={value}>{children}</VariantMediaContext.Provider>;
}

export function useVariantMedia() {
  return useContext(VariantMediaContext);
}
