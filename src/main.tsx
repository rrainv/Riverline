import './styles/fonts.css';
import '../tokens/tokens.css';
import './styles/base.css';

import { render } from 'preact';
import { initAppearance, langSignal } from './domain/appearance';
import { applyQueryOverrides, installTestHook } from './domain/testHook';
import { ensureLocaleLoaded } from './i18n';
import { App } from './App';

initAppearance();
applyQueryOverrides(window.location.search, window.location.pathname);
installTestHook();

const mountApp = () => {
  const mount = document.getElementById('app');
  if (mount) {
    render(<App />, mount);
  }
};

if (langSignal.value !== 'en') {
  void ensureLocaleLoaded(langSignal.value).finally(mountApp);
} else {
  mountApp();
}
