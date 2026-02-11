import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { join } from "path";
import tokenRoutes from "./routes/tokens";
import screenerRoutes from "./routes/screeners";
import strategyRoutes from "./routes/strategies";

const app = new Hono();

// ---------- Middleware ----------
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// ---------- API Routes ----------
app.route("/api/tokens", tokenRoutes);
app.route("/api/screeners", screenerRoutes);
app.route("/api/strategies", strategyRoutes);

// ---------- Health Check ----------
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    service: "bullseye-backend",
    timestamp: new Date().toISOString(),
  });
});

// ---------- Serve Frontend Static Files ----------
const DIST_DIR = join(import.meta.dir, "..", "..", "frontend", "dist");

app.use(
  "/*",
  serveStatic({
    root: DIST_DIR,
    rewriteRequestPath: (path) => path,
  })
);

// SPA fallback — serve index.html for any non-API, non-file route
app.get("*", async (c) => {
  const indexPath = join(DIST_DIR, "index.html");
  const file = Bun.file(indexPath);
  if (await file.exists()) {
    return c.html(await file.text());
  }
  return c.text("Frontend not built. Run `bun run build` in frontend/.", 404);
});

// ---------- Start Server ----------
const PORT = parseInt(process.env.PORT || "3001");

console.log(`
  ╔══════════════════════════════════════╗
  ║   🎯 BULLSEYE Backend Server        ║
  ║   Running on port ${PORT}              ║
  ║   http://localhost:${PORT}             ║
  ╚══════════════════════════════════════╝
`);

export default {
  port: PORT,
  fetch: app.fetch,
};
