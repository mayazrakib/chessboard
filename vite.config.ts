import { fileURLToPath, } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, } from "vite";

const DEMO_DIRECTORY = fileURLToPath(new URL(
    "./showcase",
    import.meta.url,
),);

export default defineConfig({
    plugins: [react(), tailwindcss(),],

    resolve: {
        alias: {
            "@": DEMO_DIRECTORY,
        },
    },
},);
