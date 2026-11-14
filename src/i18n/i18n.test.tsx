import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance, updateAppearance } from '../domain/appearance';
import { CATALOGUES, formatNumber, formatPercent, t } from './index';
import { PokerNotation } from './PokerNotation';

describe('i18n formatting, plurals, and PokerNotation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('interpolates named placeholders across all three locales', () => {
    expect(t('topbar.breadcrumb', { room: 'Equity', section: 'Overview' }, 'en')).toBe(
      'Equity · Overview',
    );
    expect(t('topbar.breadcrumb', { room: 'Эквити', section: 'Обзор' }, 'ru')).toBe(
      'Эквити · Обзор',
    );
    expect(t('topbar.breadcrumb', { room: 'אקוויטי', section: 'סקירה' }, 'he')).toBe(
      'אקוויטי · סקירה',
    );
  });

  it('applies locale plural rules for English, Russian, and Hebrew', () => {
    expect(t('palette.resultCount', { count: 1 }, 'en')).toBe('1 destination');
    expect(t('palette.resultCount', { count: 3 }, 'en')).toBe('3 destinations');

    expect(t('palette.resultCount', { count: 1 }, 'ru')).toBe('1 раздел');
    expect(t('palette.resultCount', { count: 2 }, 'ru')).toBe('2 раздела');
    expect(t('palette.resultCount', { count: 5 }, 'ru')).toBe('5 разделов');
    expect(t('palette.resultCount', { count: 21 }, 'ru')).toBe('21 раздел');

    expect(t('palette.resultCount', { count: 1 }, 'he')).toBe('יעד 1');
    expect(t('palette.resultCount', { count: 2 }, 'he')).toBe('2 יעדים');
    expect(t('palette.resultCount', { count: 5 }, 'he')).toBe('5 יעדים');
  });

  it('follows active signal locale when no explicit locale argument is given', () => {
    updateAppearance({ lang: 'he' });
    expect(t('rooms.equity.nav')).toBe('אקוויטי');
    updateAppearance({ lang: 'ru' });
    expect(t('rooms.equity.nav')).toBe('Эквити');
  });

  it('formats numbers and percentages using Intl.NumberFormat', () => {
    expect(formatNumber(1326, undefined, 'en')).toBe('1,326');
    expect(formatPercent(0.256, 1, 'en')).toBe('25.6%');
    expect(formatNumber(25.6, { minimumFractionDigits: 1 }, 'ru')).toBe(
      new Intl.NumberFormat('ru', { minimumFractionDigits: 1 }).format(25.6),
    );
  });

  it('renders PokerNotation inside <bdi dir="ltr">', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(<PokerNotation>AhKh vs QsQc</PokerNotation>, host);
    const bdi = host.querySelector('bdi');
    expect(bdi).not.toBeNull();
    expect(bdi?.getAttribute('dir')).toBe('ltr');
    expect(bdi?.textContent).toBe('AhKh vs QsQc');
  });

  it('contains no em or en dashes in any catalogue string', () => {
    for (const catalogue of Object.values(CATALOGUES)) {
      for (const value of Object.values(catalogue)) {
        const texts = typeof value === 'string' ? [value] : Object.values(value);
        for (const text of texts) {
          expect(text).not.toMatch(/[\u2013\u2014]/);
        }
      }
    }
  });
});
