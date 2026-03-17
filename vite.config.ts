import { defineConfig } from "vite"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import netlifyReactRouter from "@netlify/vite-plugin-react-router"
import path from "path"

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), netlifyReactRouter()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
})
