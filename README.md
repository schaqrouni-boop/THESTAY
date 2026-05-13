# Suivi Chantier — Menuiserie & Cuisines

Application web **mobile-first** (React + Vite + Tailwind CSS) pour le suivi des travaux de menuiserie bois et cuisines sur un chantier d'appartements.

Optimisée pour usage sur smartphone/tablette sur site — gros boutons compatibles gants, contraste élevé pour utilisation en plein soleil, fonctionne hors-ligne (PWA).

## Structure

- **3 typologies** : Studio 1C (25 unités), Appartement 2C (11), Appartement 3C (10) — soit **46 unités** au total
- **Cuisine** identique pour toutes : 4 éléments (caissons haut/bas, crédence, façades)
- **Menuiserie** : 4 / 8 / 11 éléments selon la typologie
- Données persistées en `localStorage` + export CSV

## Fonctionnalités

- Navigation par onglets (typologies) avec progression par typologie
- Cartes-unités en accordéon avec progression individuelle (X/Y · %)
- Code couleur : vert = terminé, orange = en cours, gris = non commencé
- Filtres : Tout / Non commencé / En cours / Terminé
- Export CSV (séparateur `;`, BOM UTF-8 — compatible Excel)
- Bouton de réinitialisation (avec confirmation)
- PWA installable : "Ajouter à l'écran d'accueil"
- Mode hors-ligne via Service Worker

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173 sur le PC, ou sur le téléphone connecté au même Wi-Fi via l'URL `http://<IP-PC>:5173`.

## Build de production

```bash
npm run build
npm run preview
```

Le build est généré dans `dist/`.

## Déploiement en ligne

### Option 1 — Vercel (recommandé, gratuit)

1. Créer un compte sur https://vercel.com
2. Pousser ce dépôt sur GitHub
3. "Add New Project" → importer le repo → Vercel détecte Vite automatiquement → Deploy
4. URL en `*.vercel.app` immédiatement disponible

### Option 2 — Netlify

1. https://app.netlify.com → "Add new site" → "Import from Git"
2. Build command : `npm run build` · Publish directory : `dist`

### Option 3 — GitHub Pages

```bash
npm run build
# Puis publier le contenu de dist/ sur la branche gh-pages
```

Note : `base: './'` est déjà configuré dans `vite.config.js` pour fonctionner avec n'importe quel chemin.

## Stockage des données

Toutes les saisies sont stockées dans le `localStorage` du navigateur sous la clé `suivi-chantier-v1`. **Important** : les données sont locales à chaque appareil/navigateur. Pour les centraliser, exporter régulièrement le CSV.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- vite-plugin-pwa (Workbox)
