import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export interface LazyComponentWithPreload<P extends object> {
  (props: P): preact.JSX.Element;
  preload: () => void;
}

export function createLazyComponent<P extends object>(
  loader: () => Promise<ComponentType<P>>,
): ComponentType<P> & { preload: () => void } {
  let Resolved: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;

  function ensureLoaded(): Promise<ComponentType<P>> {
    pending ??= loader().then((comp) => {
      Resolved = comp;
      return comp;
    });
    return pending;
  }

  function LazyRouteWrapper(props: P) {
    const [, setTick] = useState(0);

    useEffect(() => {
      if (Resolved) return;
      let alive = true;
      void ensureLoaded().then(() => {
        if (alive) setTick((n) => n + 1);
      });
      return () => {
        alive = false;
      };
    }, []);

    if (!Resolved) return <section aria-busy="true" />;
    return <Resolved {...props} />;
  }

  LazyRouteWrapper.preload = () => {
    if (!Resolved) void ensureLoaded();
  };

  return LazyRouteWrapper;
}
