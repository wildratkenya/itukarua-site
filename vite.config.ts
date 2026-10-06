import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Mirrors vercel.json's /img/a/:match* + /img/:bucket/:match* rewrites:
      // one generic rule, with the 'a' -> 'adverts' alias (BUCKET_ALIASES in
      // src/lib/supabase.ts) applied inside the rewrite. Buckets other than
      // adverts pass through under their own name.
      '/img/': {
        target: 'https://xahaxtbudiubelemewna.supabase.co/storage/v1/object/public/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/img\//, '').replace(/^a\//, 'adverts/'),
      },
      '/supabase': {
        target: 'https://xahaxtbudiubelemewna.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
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
