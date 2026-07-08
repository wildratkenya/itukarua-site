import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/img/a/': {
        target: 'https://xahaxtbudiubelemewna.supabase.co/storage/v1/object/public/adverts/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/img\/a\//, ''),
      },
    },
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
