# Third-party dependencies and licences

Every external package and bundled font used by Riverline is recorded here before shipping.
Copyleft code is excluded by policy (`docs/DECISIONS.md` B20).

## Bundled fonts (offline, no network requests)

| Asset | Source package | Subsets bundled | Licence |
|---|---|---|---|
| Inter (variable `wght`) | `@fontsource-variable/inter@5.3.0` | Latin, Latin-ext, Cyrillic, Cyrillic-ext (`woff2`) | SIL Open Font License 1.1 (`OFL-1.1`) |
| Rubik (variable `wght`) | `@fontsource-variable/rubik@5.3.0` | Latin, Latin-ext, Cyrillic, Cyrillic-ext, Hebrew (`woff2`) | SIL Open Font License 1.1 (`OFL-1.1`) |

## Runtime dependencies

| Package | Version | Purpose | Licence |
|---|---|---|---|
| `preact` | `10.29.8` | UI component runtime | `MIT` |
| `@preact/signals` | `2.11.4` | Reactive signal state (with `@preact/signals-core@1.14.5`) | `MIT` |
| `@fontsource-variable/inter` | `5.3.0` | Local Inter variable font files | `OFL-1.1` |
| `@fontsource-variable/rubik` | `5.3.0` | Local Rubik variable font files | `OFL-1.1` |

## Development and build dependencies

| Package | Version | Purpose | Licence |
|---|---|---|---|
| `vite` | `6.4.6` | Build tool and dev/preview server | `MIT` |
| `@preact/preset-vite` | `2.10.6` | Preact JSX transform for Vite | `MIT` |
| `typescript` | `5.9.3` | Strict TypeScript type checker | `Apache-2.0` |
| `vitest` | `3.2.7` | Unit and behaviour test runner | `MIT` |
| `jsdom` | `26.1.0` | DOM, `localStorage`, and History/URL environment for Vitest | `MIT` |
