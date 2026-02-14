# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

## Deploy to Vercel

This app is ready for Vercel as a static Vite SPA.

### 1) Import project

- In Vercel, create a new project and import this repository.
- Framework preset: **Vite**.

### 2) Configure environment variables

Add these variables in Vercel for each environment you deploy (Production/Preview):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If these are missing, the app will throw at startup in `src/lib/supabaseClient.ts`.

### 2b) Configure Supabase Auth URLs (important)

If OAuth redirects from Vercel back to `localhost`, update Supabase URL settings:

- Supabase Dashboard -> **Authentication** -> **URL Configuration**
- Set **Site URL** to your production Vercel URL (or custom domain), for example:
  - `https://magic-yarn.vercel.app`
- Add these **Redirect URLs** so local and hosted can work in parallel:
  - `http://localhost:5173/**`
  - `https://magic-yarn.vercel.app/**`
  - `https://*.vercel.app/**` (for preview deployments)

The app already uses `window.location.origin` as OAuth `redirectTo`, so once these allow-list entries are set, each environment returns to itself.

### 3) Build settings

These are already reflected in `vercel.json`:

- Build command: `npm run build`
- Output directory: `dist`

### 4) SPA routing

Because the app uses `BrowserRouter`, direct navigation to routes like `/recipients`, `/deliveries/new`, or `/admin/users` needs a rewrite to `index.html`.

`vercel.json` includes this rewrite:

- `/(.*)` -> `/index.html`

### 5) Deploy

- Click **Deploy** in Vercel.
- After deploy, test direct URL refresh on a nested route (for example `/admin/users`) to confirm SPA routing works.
