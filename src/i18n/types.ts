export type PluralCategory = Intl.LDMLPluralRule;

export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type MessageValue = string | PluralForms;

export type TemplateVars = Record<string, string | number>;

export interface MessageCatalogue {
  'app.name': string;
  'app.tagline': string;
  'topbar.searchButton': string;
  'topbar.searchLabel': string;
  'topbar.settings': string;
  'topbar.focusEnter': string;
  'topbar.focusExit': string;
  'topbar.breadcrumb': string;
  'dock.ariaLabel': string;
  'rail.title': string;
  'rail.collapse': string;
  'rail.expand': string;
  'rail.overview': string;
  'rail.settingsAppearance': string;
  'rail.kitSheet': string;
  'palette.placeholder': string;
  'palette.inputLabel': string;
  'palette.close': string;
  'palette.empty': string;
  'palette.resultCount': PluralForms;
  'rooms.home.nav': string;
  'rooms.home.title': string;
  'rooms.home.empty': string;
  'rooms.training.nav': string;
  'rooms.training.title': string;
  'rooms.training.empty': string;
  'rooms.strategy.nav': string;
  'rooms.strategy.title': string;
  'rooms.strategy.empty': string;
  'rooms.hand.nav': string;
  'rooms.hand.title': string;
  'rooms.hand.empty': string;
  'rooms.equity.nav': string;
  'rooms.equity.title': string;
  'rooms.equity.empty': string;
  'rooms.review.nav': string;
  'rooms.review.title': string;
  'rooms.review.empty': string;
  'rooms.nights.nav': string;
  'rooms.nights.title': string;
  'rooms.nights.empty': string;
  'rooms.learn.nav': string;
  'rooms.learn.title': string;
  'rooms.learn.empty': string;
  'rooms.settings.nav': string;
  'rooms.settings.title': string;
  'rooms.kit.nav': string;
  'rooms.kit.title': string;
  'rooms.kit.empty': string;
  'settings.eyebrow': string;
  'settings.heading': string;
  'settings.subtitle': string;
  'settings.themes.label': string;
  'settings.themes.midnight': string;
  'settings.themes.felt': string;
  'settings.themes.slate': string;
  'settings.themes.dusk': string;
  'settings.themes.contrast': string;
  'settings.themes.daylight': string;
  'settings.themes.paper': string;
  'settings.pace.label': string;
  'settings.pace.hint': string;
  'settings.pace.calm': string;
  'settings.pace.normal': string;
  'settings.pace.fast': string;
  'settings.motion.label': string;
  'settings.motion.hint': string;
  'settings.motion.system': string;
  'settings.motion.reduced': string;
  'settings.language.label': string;
  'settings.language.hint': string;
  'settings.language.en': string;
  'settings.language.ru': string;
  'settings.language.he': string;
  'settings.language.sampleNotation': string;
}

export type MessageKey = keyof MessageCatalogue;
