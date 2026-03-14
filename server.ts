import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Vite Middleware (Must be last)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    const indexPath = path.resolve(distPath, "index.html");
    
    console.log(`[VERITAS] Production Mode Detected`);
    console.log(`[VERITAS] distPath: ${distPath}`);
    console.log(`[VERITAS] index.html exists: ${fs.existsSync(indexPath)}`);

    app.get("/health", (req, res) => res.send("VERITAS_OK"));

    app.use(express.static(distPath));
    
    // SPA Fallback: Serve index.html for all non-file requests
    app.get("*", (req, res) => {
      console.log(`[VERITAS] Request received for: ${req.url}`);
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
