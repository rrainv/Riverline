import { signal } from '@preact/signals';

export const ROOM_IDS = [
  'home',
  'training',
  'strategy',
  'hand',
  'equity',
  'review',
  'nights',
  'learn',
] as const;

export type RoomId = (typeof ROOM_IDS)[number];
export type RouteId = RoomId | 'settings' | 'kit';

export const ALL_ROUTE_IDS: readonly RouteId[] = [...ROOM_IDS, 'settings', 'kit'];

export const ROUTE_PATHS: Record<RouteId, string> = {
  home: '/',
  training: '/training',
  strategy: '/strategy',
  hand: '/hand',
  equity: '/equity',
  review: '/review',
  nights: '/nights',
  learn: '/learn',
  settings: '/settings',
  kit: '/kit',
};

const PATH_TO_ROUTE: Record<string, RouteId> = Object.fromEntries(
  (Object.entries(ROUTE_PATHS) as [RouteId, string][]).map(([id, path]) => [path, id]),
) as Record<string, RouteId>;

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === 'string' && (ALL_ROUTE_IDS as readonly string[]).includes(value);
}

export function routeFromPathname(pathname: string): RouteId {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PATH_TO_ROUTE[trimmed] ?? 'home';
}

export function resolveRouteFromLocation(pathname: string, search: string): RouteId {
  const params = new URLSearchParams(search);
  const queryRoom = params.get('room');
  if (isRouteId(queryRoom)) {
    return queryRoom;
  }
  return routeFromPathname(pathname);
}

export interface ReturnContext {
  readonly fromRoute: RouteId;
  readonly label: string;
  readonly onReturn: () => void;
}

export const activeRouteSignal = signal<RouteId>('home');
export const railCollapsedSignal = signal<boolean>(false);
export const focusModeSignal = signal<boolean>(false);
export const paletteOpenSignal = signal<boolean>(false);
export const returnContextSignal = signal<ReturnContext | null>(null);

export const KIT_SECTION_IDS = [
  'panel',
  'button',
  'chip',
  'choice',
  'input',
  'factTile',
  'overlay',
  'stepper',
  'playingCard',
  'feltTable',
  'optionTickets',
  'mixBar',
  'equityRow',
  'historyRail',
  'lamp',
  'heatGrid',
  'familyStrip',
] as const;
export type KitSectionId = (typeof KIT_SECTION_IDS)[number];
export const kitSectionSignal = signal<KitSectionId>('panel');

export function isKitSectionId(value: unknown): value is KitSectionId {
  return typeof value === 'string' && (KIT_SECTION_IDS as readonly string[]).includes(value);
}

export function setReturnContext(ctx: ReturnContext | null): void {
  returnContextSignal.value = ctx;
}

export function navigateTo(
  route: RouteId,
  options: { pushHistory?: boolean; preserveReturn?: boolean } = {},
): void {
  if (!options.preserveReturn) {
    returnContextSignal.value = null;
  }
  activeRouteSignal.value = route;
  paletteOpenSignal.value = false;
  if (
    options.pushHistory !== false &&
    typeof window !== 'undefined' &&
    window.history &&
    typeof window.history.pushState === 'function'
  ) {
    const nextPath = ROUTE_PATHS[route];
    if (window.location.pathname !== nextPath || window.location.search !== '') {
      window.history.pushState({ route }, '', nextPath);
    }
  }
}

export function toggleRail(): void {
  railCollapsedSignal.value = !railCollapsedSignal.value;
}

export function toggleFocusMode(): void {
  focusModeSignal.value = !focusModeSignal.value;
}

export function openPalette(): void {
  paletteOpenSignal.value = true;
}

export function closePalette(): void {
  paletteOpenSignal.value = false;
}

export function syncRouteFromBrowserLocation(): RouteId {
  if (typeof window === 'undefined') return activeRouteSignal.value;
  const route = resolveRouteFromLocation(window.location.pathname, window.location.search);
  activeRouteSignal.value = route;
  return route;
}
