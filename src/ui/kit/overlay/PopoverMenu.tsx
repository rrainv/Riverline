import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from '../state';
import { useEscapeLayer } from './Overlay';
import styles from './Overlay.module.css';

export interface PopoverMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly anchorEl: HTMLElement | null;
  readonly children: ComponentChildren;
  readonly width?: number;
  readonly className?: string;
}

export function PopoverMenu({
  open,
  onClose,
  anchorEl,
  children,
  width = 260,
  className,
}: PopoverMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEscapeLayer(open, onClose);

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setPos(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 260;
    const pad = 8;
    const left = Math.max(
      pad,
      Math.min(window.innerWidth - width - pad, rect.right - width),
    );
    const fitsBelow = rect.bottom + 4 + menuHeight <= window.innerHeight - pad;
    const top = fitsBelow
      ? rect.bottom + 4
      : Math.max(pad, rect.top - 4 - menuHeight);
    setPos({ top, left });
  }, [open, anchorEl, width]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (menuRef.current?.contains(target) || anchorEl?.contains(target))
      ) {
        return;
      }
      onClose();
    };
    const onViewportChange = () => onClose();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [open, anchorEl, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cx(styles.popoverMenu, className)}
      style={
        pos
          ? { top: `${pos.top}px`, left: `${pos.left}px`, width: `${width}px` }
          : { top: '-9999px', left: '-9999px', width: `${width}px` }
      }
    >
      {children}
    </div>,
    document.body,
  );
}
