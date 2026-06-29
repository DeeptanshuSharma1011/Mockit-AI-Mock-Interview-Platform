import dotenv from "dotenv";
// Load environment variables early with override to ensure .env variables take priority
dotenv.config({ override: true });

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { connectDB } from "./server/config/db";
import apiRouter from "./server/routes/api";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS middleware for convenience
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Connect to MongoDB or fall back gracefully
  await connectDB();

  // Bind the MVC routers
  app.use("/api", apiRouter);

  // --- Vite Dev Server & Static Asset Serving ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Mockit - Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical failure during server startup:", err);
});
