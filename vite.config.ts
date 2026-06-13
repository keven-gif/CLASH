import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

let devPlugins: any[] = [];
if (process.env.NODE_ENV !== 'production') {
  try {
    const { inspectAttr } = await import('plugin-inspect-react-code');
    devPlugins = [inspectAttr()];
  } catch {
    // dev plugin not available, skip
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/CLASH/',
  plugins: [...devPlugins, react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
