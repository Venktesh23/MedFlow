# MedFlow Frontend

A React frontend for MedFlow, built with React 18, React Router 6, TypeScript, Vite, Vitest, and TailwindCSS.

## Tech Stack

- **PNPM**: Prefer pnpm
- **Frontend**: React 18 + React Router 6 + TypeScript + Vite + TailwindCSS 3
- **Testing**: Vitest
- **UI**: Radix UI + TailwindCSS 3

## Project Structure

```
src/
├── pages/                 # Route components, Dashboard.tsx is the first page
├── components/            # Reusable app components
│   ├── dashboard/         # Dashboard-specific extracted Anima components
│   └── ui/                # Shared UI primitives
├── hooks/
├── lib/
├── App.tsx                # App entry point and route setup
└── global.css             # TailwindCSS and global styles
```

## Adding Pages From Anima

1. Keep each raw Anima export folder at the project root as source material.
2. Convert the page into `src/pages/<PageName>.tsx`.
3. Extract reusable pieces into `src/components/<feature>/`.
4. Move hardcoded display data into typed dummy arrays or props so real data can replace it later.
5. Preserve Anima design values exactly: colors, font sizes, spacing, border radii, shadows, and assets.
6. Add the new route in `src/App.tsx`.

## Styling

- TailwindCSS is the primary styling system.
- Global font imports and base styles live in `src/global.css`.
- Tailwind scans `src/**/*.{ts,tsx}`.
- Use the `@/*` alias for imports from `src/*`.

## Development Commands

```bash
pnpm dev        # Start Vite dev server
pnpm build      # Build the frontend
pnpm preview    # Preview production build
pnpm typecheck  # TypeScript validation
pnpm test       # Run Vitest tests
```
