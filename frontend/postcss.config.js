import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tailwind config lives at repository root (shared layout); plugins resolve from frontend/node_modules.
export default {
  plugins: [
    tailwindcss({ config: path.join(__dirname, "./tailwind.config.ts") }),
    autoprefixer(),
  ],
};
