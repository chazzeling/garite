import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 창 엔트리 3개: main(index.html), chat(chat.html), shop(shop.html)
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        chat: "chat.html",
        shop: "shop.html",
      },
    },
  },
});
