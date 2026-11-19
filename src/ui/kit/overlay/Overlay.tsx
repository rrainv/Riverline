import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../button/Button';
import { cx } from '../state';
import styles from './Overlay.module.css';

interface EscapeEntry {
  id: symbol;
  onEscape: () => void;
}

const escapeStack: EscapeEntry[] = [];

function onWindowKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  top.onEscape();
}

export function registerEscapeLayer(onEscape: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (escapeStack.length === 0) {
    window.addEventListener('keydown', onWindowKeyDown);
  }
  const id = Symbol('escape-layer');
  escapeStack.push({ id, onEscape });
  return () => {
    const idx = escapeStack.findIndex((e) => e.id === id);
    if (idx !== -1) escapeStack.splice(idx, 1);
    if (escapeStack.length === 0) {
      window.removeEventListener('keydown', onWindowKeyDown);
    }
  };
}

export function useEscapeLayer(active: boolean, onEscape: () => void) {
  const cbRef = useRef(onEscape);
  cbRef.current = onEscape;

  const disposeRef = useRef<(() => void) | null>(null);
  if (active && !disposeRef.current) {
    disposeRef.current = registerEscapeLayer(() => cbRef.current());
  } else if (!active && disposeRef.current) {
    disposeRef.current();
    disposeRef.current = null;
  }

  useEffect(() => {
    if (active && !disposeRef.current) {
      disposeRef.current = registerEscapeLayer(() => cbRef.current());
    } else if (!active && disposeRef.current) {
      disposeRef.current();
      disposeRef.current = null;
    }
    return () => {
      if (disposeRef.current) {
        disposeRef.current();
        disposeRef.current = null;
      }
    };
  }, [active]);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocus(
  open: boolean,
  containerRef: { current: HTMLElement | null },
  initialFocusRef?: { current: HTMLElement | null },
  returnFocusTo?: HTMLElement | null,
) {
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null | undefined>(returnFocusTo);
  returnFocusRef.current = returnFocusTo;

  if (open && !wasOpenRef.current) {
    wasOpenRef.current = true;
    if (typeof document !== 'undefined') {
      previousActiveRef.current =
        returnFocusTo ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    queueMicrotask(() => {
      const target =
        initialFocusRef?.current ??
        containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        containerRef.current;
      target?.focus();
    });
  } else if (!open && wasOpenRef.current) {
    wasOpenRef.current = false;
    const target = returnFocusTo ?? previousActiveRef.current;
    queueMicrotask(() => {
      if (target && target.isConnected) {
        target.focus();
      }
    });
  }

  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        const target = returnFocusRef.current ?? previousActiveRef.current;
        if (target && target.isConnected) {
          target.focus();
        }
      }
    };
  }, []);
}

export function trapFocusKeyDown(event: KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return;
  const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last?.focus();
    }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault();
    first?.focus();
  }
}

export interface TooltipProps {
  content: ComponentChildren;
  children: ComponentChildren;
  /** Sheet only: keep tooltip visible without hover/focus. */
  defaultOpen?: boolean;
}

/**
 * Floating tooltip using --overlay-* tokens. Opens on hover or focus; Escape dismisses.
 */
export function Tooltip({ content, children, defaultOpen = false }: TooltipProps) {
  const [open, setOpen] = useState(defaultOpen);
  const tipId = useId();
  useEscapeLayer(open && !defaultOpen, () => setOpen(false));

  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!defaultOpen) setOpen(false);
      }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => {
        if (!defaultOpen) setOpen(false);
      }}
    >
      <span aria-describedby={open ? tipId : undefined} className={styles.tooltipTrigger}>
        {children}
      </span>
      {open && (
        <span id={tipId} role="tooltip" className={styles.tooltipBubble}>
          {content}
        </span>
      )}
    </span>
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ComponentChildren;
  description?: ComponentChildren;
  /**
   * When set, this is a destructive dialog requiring type-to-confirm of the exact object name
   * (e.g. a session name) before the confirm action is enabled.
   */
  confirmPhrase?: string;
  confirmLabel?: ComponentChildren;
  cancelLabel?: ComponentChildren;
  onConfirm?: () => void;
  returnFocusTo?: HTMLElement | null;
  /** When true, renders inline inside a container (used on /kit preview stages) instead of fixed viewport. */
  inlinePreview?: boolean;
  /** Optional wider dialog width for 13-column pickers or grids. */
  wide?: boolean;
  children?: ComponentChildren;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmPhrase,
  confirmLabel,
  cancelLabel,
  onConfirm,
  returnFocusTo,
  inlinePreview = false,
  wide = false,
  children,
}: DialogProps) {
  const [typed, setTyped] = useState('');
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const wasOpenForInputRef = useRef(false);
  if (open && !wasOpenForInputRef.current) {
    wasOpenForInputRef.current = true;
  } else if (!open && wasOpenForInputRef.current) {
    wasOpenForInputRef.current = false;
    if (typed !== '') setTyped('');
  }

  useEscapeLayer(open && !inlinePreview, onClose);
  useModalFocus(
    open && !inlinePreview,
    surfaceRef,
    confirmPhrase !== undefined ? inputRef : undefined,
    returnFocusTo,
  );

  if (!open) return null;

  const isDestructive = confirmPhrase !== undefined;
  const canConfirm = !isDestructive || typed.trim() === confirmPhrase.trim();
  const showFooter = !inlinePreview || onConfirm !== undefined || cancelLabel !== undefined;

  return (
    <div
      className={cx(styles.backdrop, inlinePreview && styles.backdropInline)}
      role="dialog"
      aria-modal={inlinePreview ? undefined : 'true'}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descId : undefined}
      onKeyDown={(e) => {
        if (!inlinePreview) trapFocusKeyDown(e, surfaceRef.current);
      }}
    >
      <button
        type="button"
        className={styles.scrim}
        onClick={onClose}
        aria-label={t('kit.overlay.close')}
        tabIndex={-1}
      />
      <div ref={surfaceRef} className={cx(styles.surface, wide && styles.surfaceWide)}>
        <header className={styles.surfaceHeader}>
          <h3 id={titleId} className={styles.surfaceTitle}>
            {title}
          </h3>
        </header>

        {description !== undefined && (
          <p id={descId} className={styles.surfaceDesc}>
            {description}
          </p>
        )}

        {children}

        {isDestructive && (
          <div className={styles.confirmBlock}>
            <label className={styles.confirmLabel} htmlFor={`${titleId}-confirm`}>
              {tNodes('kit.overlay.typeToConfirm', {
                phrase: <PokerNotation>{confirmPhrase}</PokerNotation>,
              })}
            </label>
            <input
              ref={inputRef}
              id={`${titleId}-confirm`}
              type="text"
              className={styles.confirmInput}
              value={typed}
              placeholder={confirmPhrase}
              onInput={(e) => setTyped(e.currentTarget.value)}
              onChange={(e) => setTyped(e.currentTarget.value)}
            />
          </div>
        )}

        {showFooter && (
          <footer className={styles.surfaceFooter}>
            <Button variant="secondary" onClick={onClose}>
              {cancelLabel ?? t('kit.overlay.cancel')}
            </Button>
            {onConfirm && (
              <Button
                variant={isDestructive ? 'danger' : 'primary'}
                disabled={!canConfirm}
                onClick={() => {
                  if (canConfirm) onConfirm();
                }}
              >
                {confirmLabel ?? t('kit.overlay.confirm')}
              </Button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export interface ToastProps {
  open: boolean;
  message: ComponentChildren;
  actionLabel?: ComponentChildren;
  onAction?: () => void;
  onDismiss?: () => void;
  inlinePreview?: boolean;
}

/** Toast rising from the dock edge (--dur-3, --overlay-*). */
export function Toast({
  open,
  message,
  actionLabel,
  onAction,
  onDismiss,
  inlinePreview = false,
}: ToastProps) {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(styles.toast, inlinePreview && styles.toastInline)}
    >
      <span className={styles.toastMessage}>{message}</span>
      {actionLabel !== undefined && onAction && (
        <button type="button" className={styles.toastAction} onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className={styles.toastClose}
          aria-label={t('kit.overlay.close')}
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

export interface PhoneSheetProps {
  open: boolean;
  onClose: () => void;
  title: ComponentChildren;
  returnFocusTo?: HTMLElement | null;
  inlinePreview?: boolean;
  children: ComponentChildren;
}

/** Bottom sheet for narrow/phone game-night layouts (--overlay-* tokens). */
export function PhoneSheet({
  open,
  onClose,
  title,
  returnFocusTo,
  inlinePreview = false,
  children,
}: PhoneSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEscapeLayer(open && !inlinePreview, onClose);
  useModalFocus(open && !inlinePreview, sheetRef, undefined, returnFocusTo);

  if (!open) return null;

  return (
    <div
      className={cx(styles.sheetBackdrop, inlinePreview && styles.backdropInline)}
      role="dialog"
      aria-modal={inlinePreview ? undefined : 'true'}
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (!inlinePreview) trapFocusKeyDown(e, sheetRef.current);
      }}
    >
      <button
        type="button"
        className={styles.scrim}
        onClick={onClose}
        aria-label={t('kit.overlay.close')}
        tabIndex={-1}
      />
      <div ref={sheetRef} className={styles.sheet}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <header className={styles.sheetHeader}>
          <h3 id={titleId} className={styles.surfaceTitle}>
            {title}
          </h3>
          <Button variant="secondary" onClick={onClose}>
            {t('kit.overlay.close')}
          </Button>
        </header>
        <div className={styles.sheetBody}>{children}</div>
      </div>
    </div>
  );
}
