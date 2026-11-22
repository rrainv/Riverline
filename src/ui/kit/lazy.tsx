import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export function createLazyComponent<P extends object>(
  loader: () => Promise<ComponentType<P>>,
): ComponentType<P> {
  let Resolved: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;

  return function LazyRouteWrapper(props: P) {
    const [, setTick] = useState(0);

    useEffect(() => {
      if (Resolved) return;
      let alive = true;
      pending ??= loader().then((comp) => {
        Resolved = comp;
        return comp;
      });
      void pending.then(() => {
        if (alive) setTick((n) => n + 1);
      });
      return () => {
        alive = false;
      };
    }, []);

    if (!Resolved) return null;
    return <Resolved {...props} />;
  };
}
