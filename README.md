# PhantomShield 8.1 para GeckoView

Extensión WebExtension MV2 integrada para GeckoView. La versión 8.1 prioriza bloqueo útil, controles reales y compatibilidad: evita alterar APIs globales de todas las páginas salvo cuando una función lo necesita y puede desactivarse.

## Qué incluye

- Bloqueo de red mediante dominios incluidos y listas EasyList, EasyPrivacy y uBlock filters.
- Ocultamiento visual reversible: al apagar el bloqueo, la hoja de estilos deja de aplicarse.
- Eliminación de parámetros de rastreo en URLs y salto de páginas intermedias comunes.
- Detección de anuncios basada en pistas estructurales del DOM en páginas compatibles.
- Aislamiento de fingerprinting con valores estables por sitio o sesión.
- Control por sitio persistente en almacenamiento local.
- Panel popup con diseño adaptado a pantallas móviles.

## Estructura

```text
├── manifest.json
├── background/
│   ├── background.js
│   ├── network-engine.js
│   ├── filter-lists.js
│   ├── updater.js
│   ├── cname-uncloaker.js
│   └── surrogate-redirects.js
├── content/
│   ├── content-script.js
│   ├── page-hooks.js
│   ├── heuristic-vision.js
│   ├── link-bypass.js
│   ├── cosmetic-filter.js
│   ├── scriptlets.js
│   ├── anti-antiblock.js
│   ├── youtube-defuser.js
│   ├── twitch-defuser.js
│   ├── spotify-defuser.js
│   └── farbling.js
├── data/
│   ├── domains-adservers.js
│   ├── domains-trackers.js
│   ├── domains-popups.js
│   ├── cosmetic-rules.js
│   ├── surrogates.js
│   ├── scriptlets.js
│   └── youtube-patterns.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── icons/
│   ├── icon-48.png
│   └── icon-96.png
└── web-accessible/
    ├── noop.js
    ├── noop.html
    ├── ga-surrogate.js
    └── gtm-surrogate.js
```

## Compatibilidad con GeckoView

1. WebExtension API estándar bajo Manifest V2.
2. `webRequest` con capacidades de bloqueo completas.
3. Almacenamiento local mediante `browser.storage.local`.
4. Alarmas periódicas para actualización de listas mediante `browser.alarms`.
5. Interfaz pensada para vistas embebidas y diálogos móviles.
