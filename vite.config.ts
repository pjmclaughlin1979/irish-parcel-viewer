import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/irish-parcel-viewer/",
  plugins: [react()],
});
