import { useEffect, useState } from 'preact/hooks';
import {
  ACCENT_PRESET_IDS,
  appearanceSignal,
  CARD_BACK_IDS,
  CARD_FACE_IDS,
  CORNER_STYLES,
  DEFAULT_CUSTOM_THEME,
  evaluateCustomThemeContrast,
  HEAD_FONT_IDS,
  HEADING_WEIGHTS,
  isValidHex,
  normalizeHex,
  THEME_IDS,
  updateAppearance,
  type CustomThemeConfig,
} from '../../../domain/appearance';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Panel } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { cx } from '../../kit/state';
import styles from '../SettingsRoom.module.css';

type CustomColorKey = 'bg' | 'panel' | 'text' | 'accent';
const CUSTOM_COLOR_KEYS: readonly CustomColorKey[] = ['bg', 'panel', 'text', 'accent'];

export function SettingsAppearanceSection() {
  const prefs = appearanceSignal.value;
  const [draft, setDraft] = useState<Record<CustomColorKey, string>>({
    bg: prefs.customTheme.bg,
    panel: prefs.customTheme.panel,
    text: prefs.customTheme.text,
    accent: prefs.customTheme.accent,
  });

  useEffect(() => {
    setDraft((prev) => ({
      bg: normalizeHex(prev.bg, '') === prefs.customTheme.bg ? prev.bg : prefs.customTheme.bg,
      panel:
        normalizeHex(prev.panel, '') === prefs.customTheme.panel
          ? prev.panel
          : prefs.customTheme.panel,
      text:
        normalizeHex(prev.text, '') === prefs.customTheme.text ? prev.text : prefs.customTheme.text,
      accent:
        normalizeHex(prev.accent, '') === prefs.customTheme.accent
          ? prev.accent
          : prefs.customTheme.accent,
    }));
  }, [
    prefs.customTheme.bg,
    prefs.customTheme.panel,
    prefs.customTheme.text,
    prefs.customTheme.accent,
  ]);

  const handleColorInput = (key: CustomColorKey, next: string) => {
    setDraft((prev) => ({ ...prev, [key]: next }));
    if (isValidHex(next)) {
      updateAppearance({
        customTheme: {
          ...prefs.customTheme,
          [key]: next,
        },
      });
    }
  };

  const handleResetPalette = () => {
    const nextCustom: CustomThemeConfig = {
      ...DEFAULT_CUSTOM_THEME,
      enabled: prefs.customTheme.enabled,
    };
    setDraft({
      bg: nextCustom.bg,
      panel: nextCustom.panel,
      text: nextCustom.text,
      accent: nextCustom.accent,
    });
    updateAppearance({ customTheme: nextCustom });
  };

  const liveCustom: CustomThemeConfig = {
    enabled: prefs.customTheme.enabled,
    bg: isValidHex(draft.bg) ? normalizeHex(draft.bg, prefs.customTheme.bg) : prefs.customTheme.bg,
    panel: isValidHex(draft.panel)
      ? normalizeHex(draft.panel, prefs.customTheme.panel)
      : prefs.customTheme.panel,
    text: isValidHex(draft.text)
      ? normalizeHex(draft.text, prefs.customTheme.text)
      : prefs.customTheme.text,
    accent: isValidHex(draft.accent)
      ? normalizeHex(draft.accent, prefs.customTheme.accent)
      : prefs.customTheme.accent,
  };
  const contrastReport = evaluateCustomThemeContrast(liveCustom);
  const fmtRatio = (ratio: number) =>
    formatNumber(ratio, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className={styles.grid}>
      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionLabel}>{t('settings.themes.label')}</div>
          <div className={styles.themeGrid} role="group" aria-label={t('settings.themes.label')}>
            {THEME_IDS.map((themeId) => {
              const active = prefs.theme === themeId;
              return (
                <button
                  key={themeId}
                  type="button"
                  aria-pressed={active}
                  className={cx(styles.themeTile, active && styles.themeTileActive)}
                  onClick={() => updateAppearance({ theme: themeId })}
                >
                  <span
                    className={styles.swatchBar}
                    data-theme={themeId}
                    data-audit-allow="theme-swatch"
                    aria-hidden="true"
                  >
                    <span className={styles.swatchBg} />
                    <span className={styles.swatchPanel} />
                    <span className={styles.swatchAccent} />
                  </span>
                  <span className={styles.themeName}>{t(`settings.themes.${themeId}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.accent.label')}</div>
          <p className={styles.hint}>{t('settings.accent.hint')}</p>
          <div className={styles.chipRow} role="group" aria-label={t('settings.accent.label')}>
            {ACCENT_PRESET_IDS.map((preset) => {
              const active = prefs.accentPreset === preset;
              const swatchAccent =
                preset === 'default'
                  ? prefs.theme === 'midnight'
                    ? 'brass'
                    : undefined
                  : preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  className={cx(styles.accentBtn, active && styles.accentBtnActive)}
                  onClick={() => updateAppearance({ accentPreset: preset })}
                >
                  <span
                    className={styles.accentSwatch}
                    data-theme={prefs.theme}
                    data-accent={swatchAccent}
                    data-audit-allow="accent-swatch"
                    aria-hidden="true"
                  />
                  <span>{t(`settings.accent.${preset}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionLabel}>{t('settings.custom.label')}</div>
            <Button variant="secondary" onClick={handleResetPalette}>
              {t('settings.custom.reset')}
            </Button>
          </div>

          <div className={styles.toggleRow}>
            <button
              type="button"
              aria-pressed={prefs.customTheme.enabled}
              className={cx(
                styles.toggleBtn,
                prefs.customTheme.enabled && styles.toggleBtnActive,
              )}
              onClick={() =>
                updateAppearance({
                  customTheme: {
                    ...prefs.customTheme,
                    enabled: !prefs.customTheme.enabled,
                  },
                })
              }
            >
              <span>{t('settings.custom.toggle')}</span>
              <span
                className={cx(
                  styles.toggleTrack,
                  prefs.customTheme.enabled && styles.toggleTrackActive,
                )}
                aria-hidden="true"
              >
                <span className={styles.toggleThumb} />
              </span>
            </button>
          </div>

          <div className={styles.customGrid}>
            {CUSTOM_COLOR_KEYS.map((key) => {
              const label = t(`settings.custom.${key}`);
              return (
                <div key={key} className={styles.customField}>
                  <span className={styles.fieldLabel}>{label}</span>
                  <TextField
                    value={draft[key]}
                    ariaLabel={label}
                    placeholder={DEFAULT_CUSTOM_THEME[key]}
                    ltrInput
                    onValueChange={(next) => handleColorInput(key, next)}
                  />
                </div>
              );
            })}
          </div>

          <div
            className={cx(
              styles.contrastBox,
              contrastReport.passes ? styles.contrastBoxOk : styles.contrastBoxWarn,
            )}
            role={contrastReport.passes ? 'status' : 'alert'}
          >
            <p className={styles.contrastStatus}>
              {contrastReport.passes
                ? t('settings.custom.contrastOk')
                : t('settings.custom.contrastWarn')}
            </p>
            <p className={styles.contrastMetrics}>
              {t('settings.custom.contrastMetrics', {
                bg: fmtRatio(contrastReport.textOnBg),
                panel: fmtRatio(contrastReport.textOnPanel),
                accent: fmtRatio(contrastReport.accentOnBg),
              })}
            </p>
          </div>
        </div>
      </Panel>

      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionLabel}>{t('settings.corners.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.corners.label')}>
            {CORNER_STYLES.map((cornerStyle) => (
              <ChipButton
                key={cornerStyle}
                selected={prefs.cornerStyle === cornerStyle}
                onToggle={() => updateAppearance({ cornerStyle })}
              >
                {t(`settings.corners.${cornerStyle}`)}
              </ChipButton>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.headFont.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.headFont.label')}>
            {HEAD_FONT_IDS.map((headFont) => (
              <ChipButton
                key={headFont}
                selected={prefs.headFont === headFont}
                onToggle={() => updateAppearance({ headFont })}
              >
                {t(`settings.headFont.${headFont}`)}
              </ChipButton>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.headWeight.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.headWeight.label')}>
            {HEADING_WEIGHTS.map((headingWeight) => (
              <ChipButton
                key={headingWeight}
                selected={prefs.headingWeight === headingWeight}
                onToggle={() => updateAppearance({ headingWeight })}
              >
                <PokerNotation>{headingWeight}</PokerNotation>
              </ChipButton>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.cardFace.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.cardFace.label')}>
            {CARD_FACE_IDS.map((cardFace) => (
              <ChipButton
                key={cardFace}
                selected={prefs.cardFace === cardFace}
                onToggle={() => updateAppearance({ cardFace })}
              >
                {t(`settings.cardFace.${cardFace}`)}
              </ChipButton>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.cardBack.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.cardBack.label')}>
            {CARD_BACK_IDS.map((cardBack) => (
              <ChipButton
                key={cardBack}
                selected={prefs.cardBack === cardBack}
                onToggle={() => updateAppearance({ cardBack })}
              >
                {t(`settings.cardBack.${cardBack}`)}
              </ChipButton>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.deckColors.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.deckColors.label')}>
            <ChipButton
              selected={!prefs.fourColorDeck}
              onToggle={() => updateAppearance({ fourColorDeck: false })}
            >
              {t('settings.deckColors.two')}
            </ChipButton>
            <ChipButton
              selected={prefs.fourColorDeck}
              onToggle={() => updateAppearance({ fourColorDeck: true })}
            >
              {t('settings.deckColors.four')}
            </ChipButton>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.cardsPreview.label')}</div>
          <div
            className={styles.cardPreviewWell}
            data-card-face={prefs.cardFace}
            data-card-back={prefs.cardBack}
            data-deck-colors={prefs.fourColorDeck ? 'four' : undefined}
          >
            <PlayingCard card="As" state="face" size="large" />
            <PlayingCard card="Ah" state="face" size="large" />
            <PlayingCard card="Kd" state="face" size="large" />
            <PlayingCard card="Qc" state="face" size="large" />
            <PlayingCard state="back" size="large" />
          </div>
        </div>
      </Panel>
    </div>
  );
}
