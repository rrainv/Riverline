import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Panel } from '../../kit/panel/Panel';
import styles from '../SettingsRoom.module.css';

interface LicenceRow {
  readonly pkg: string;
  readonly version: string;
  readonly purpose: string;
  readonly licence: string;
}

const THIRD_PARTY_LICENCES: readonly LicenceRow[] = [
  {
    pkg: 'preact',
    version: '10.29.8',
    purpose: 'UI component runtime',
    licence: 'MIT',
  },
  {
    pkg: '@preact/signals',
    version: '2.11.4',
    purpose: 'Reactive signal state (with @preact/signals-core@1.14.5)',
    licence: 'MIT',
  },
  {
    pkg: '@fontsource-variable/inter',
    version: '5.3.0',
    purpose: 'Local Inter variable font files',
    licence: 'OFL-1.1',
  },
  {
    pkg: '@fontsource-variable/rubik',
    version: '5.3.0',
    purpose: 'Local Rubik variable font files',
    licence: 'OFL-1.1',
  },
  {
    pkg: 'vite',
    version: '6.4.6',
    purpose: 'Build tool and dev/preview server',
    licence: 'MIT',
  },
  {
    pkg: '@preact/preset-vite',
    version: '2.10.6',
    purpose: 'Preact JSX transform for Vite',
    licence: 'MIT',
  },
  {
    pkg: 'typescript',
    version: '5.9.3',
    purpose: 'Strict TypeScript type checker',
    licence: 'Apache-2.0',
  },
  {
    pkg: 'vitest',
    version: '3.2.7',
    purpose: 'Unit and behaviour test runner',
    licence: 'MIT',
  },
  {
    pkg: 'jsdom',
    version: '26.1.0',
    purpose: 'DOM, localStorage, and History/URL environment for Vitest',
    licence: 'MIT',
  },
  {
    pkg: 'playwright',
    version: '1.65.1',
    purpose: 'Headless Chromium runner for layout and theme audits',
    licence: 'Apache-2.0',
  },
];

export function SettingsAboutSection() {
  return (
    <div className={styles.stack}>
      <div className={styles.grid}>
        <Panel as="div" title={t('settings.about.studyTitle')}>
          <p className={styles.bodyText}>{t('settings.about.studyBody')}</p>
        </Panel>

        <Panel as="div" title={t('settings.about.rtaTitle')}>
          <p className={styles.bodyText}>{t('settings.about.rtaBody')}</p>
        </Panel>
      </div>

      <Panel as="div" title={t('settings.about.audioTitle')}>
        <p className={styles.bodyText}>{t('settings.about.audioBody')}</p>
      </Panel>

      <Panel as="div" title={t('settings.about.licencesTitle')}>
        <div className={styles.tableWrap}>
          <table className={styles.licenceTable}>
            <thead>
              <tr>
                <th scope="col">{t('settings.about.licencesColPkg')}</th>
                <th scope="col">{t('settings.about.licencesColPurpose')}</th>
                <th scope="col">{t('settings.about.licencesColLicence')}</th>
              </tr>
            </thead>
            <tbody>
              {THIRD_PARTY_LICENCES.map((row) => (
                <tr key={row.pkg}>
                  <td className={styles.pkgCell}>
                    <PokerNotation>{`${row.pkg}@${row.version}`}</PokerNotation>
                  </td>
                  <td className={styles.purposeCell}>{row.purpose}</td>
                  <td className={styles.licenceCell}>
                    <PokerNotation>{row.licence}</PokerNotation>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
