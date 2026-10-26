import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const single = !!process.env.SINGLEFILE;

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  define: { __SINGLE__: JSON.stringify(single) },
});
