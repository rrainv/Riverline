import { useState } from 'preact/hooks';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { TokenInput, type TokenValidationResult } from './TokenInput';

const FIXTURE_VALID_TOKENS = new Set([
  'btn',
  'sb',
  'bb',
  'utg',
  'hj',
  'co',
  'f',
  'x',
  'c',
  'r2.5',
  'r3',
  'r7.5',
  'r12',
  'b3.8',
  'AhKh',
  'Th9h',
  'Qs7c2h',
]);

function validateFixtureToken(token: string): TokenValidationResult {
  if (FIXTURE_VALID_TOKENS.has(token)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: tNodes('kit.input.unknownActionReason', {
      token: <PokerNotation>{token}</PokerNotation>,
    }),
  };
}

export function TokenInputSheetEntry() {
  const [restTokens, setRestTokens] = useState<string[]>(['btn', 'r2.5', 'bb', 'c']);
  const [errorTokens, setErrorTokens] = useState<string[]>(['btn', 'r12', 'bbx']);

  return (
    <div className={styles.specimenBlock} role="region" aria-label={t('kit.input.sectionTitle')}>
      <StateMatrix
        title={t('kit.input.sectionTitle')}
        states={{
          rest: (
            <TokenInput
              ariaLabel={t('kit.input.ariaLabel')}
              placeholder={t('kit.input.placeholder')}
              tokens={restTokens}
              onTokensChange={setRestTokens}
              validateToken={validateFixtureToken}
            />
          ),
          hover: (
            <TokenInput
              ariaLabel={`${t('kit.input.ariaLabel')} (${t('kit.state.hover')})`}
              placeholder={t('kit.input.placeholder')}
              tokens={['btn', 'r2.5']}
              validateToken={validateFixtureToken}
              forceState="hover"
            />
          ),
          focus: (
            <TokenInput
              ariaLabel={`${t('kit.input.ariaLabel')} (${t('kit.state.focus')})`}
              placeholder={t('kit.input.placeholder')}
              tokens={['btn', 'r2.5']}
              validateToken={validateFixtureToken}
              forceState="focus"
            />
          ),
          disabled: (
            <TokenInput
              ariaLabel={`${t('kit.input.ariaLabel')} (${t('kit.state.disabled')})`}
              placeholder={t('kit.input.placeholder')}
              tokens={['btn', 'r2.5', 'bb', 'c']}
              validateToken={validateFixtureToken}
              disabled
            />
          ),
          error: (
            <TokenInput
              ariaLabel={`${t('kit.input.ariaLabel')} (${t('kit.state.error')})`}
              placeholder={t('kit.input.placeholder')}
              tokens={errorTokens}
              onTokensChange={setErrorTokens}
              validateToken={validateFixtureToken}
            />
          ),
          empty: (
            <TokenInput
              ariaLabel={`${t('kit.input.ariaLabel')} (${t('kit.state.empty')})`}
              placeholder={t('kit.input.placeholder')}
              tokens={[]}
              validateToken={validateFixtureToken}
            />
          ),
          russianLong: (
            <TokenInput
              ariaLabel={t('kit.input.ariaLabel', undefined, 'ru')}
              placeholder={t('kit.input.placeholder', undefined, 'ru')}
              tokens={['btn', 'r12', 'z99']}
              validateToken={(tok) =>
                FIXTURE_VALID_TOKENS.has(tok)
                  ? { valid: true }
                  : {
                      valid: false,
                      reason: tNodes(
                        'kit.input.russianLongReason',
                        { token: <PokerNotation>{tok}</PokerNotation> },
                        undefined,
                        'ru',
                      ),
                    }
              }
            />
          ),
        }}
      />
    </div>
  );
}
