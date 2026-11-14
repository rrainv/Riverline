import './styles/fonts.css';
import '../tokens/tokens.css';
import './styles/base.css';

import { render } from 'preact';
import { initAppearance } from './domain/appearance';
import { applyQueryOverrides, installTestHook } from './domain/testHook';
import { App } from './App';

initAppearance();
applyQueryOverrides(window.location.search, window.location.pathname);
installTestHook();

const mount = document.getElementById('app');
if (mount) {
  render(<App />, mount);
}
