import { Hono } from "hono";
import db from "../db";

const app = new Hono();

// ---------- GET /screeners ----------
app.get("/", (c) => {
  const screeners = db
    .query("SELECT * FROM screeners ORDER BY updated_at DESC")
    .all();

  return c.json({
    screeners: screeners.map((s: Record<string, unknown>) => ({
      ...s,
      filters: JSON.parse(s.filters as string),
    })),
  });
});

// ---------- GET /screeners/:id ----------
app.get("/:id", (c) => {
  const id = c.req.param("id");
  const screener = db.query("SELECT * FROM screeners WHERE id = ?").get(id) as Record<string, unknown> | null;

  if (!screener) {
    return c.json({ error: "Screener not found" }, 404);
  }

  return c.json({
    ...screener,
    filters: JSON.parse(screener.filters as string),
  });
});

// ---------- POST /screeners ----------
app.post("/", async (c) => {
  const body = await c.req.json();
  const { name, filters, sortField, sortDirection } = body;

  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  const id = crypto.randomUUID();

  db.query(
    `INSERT INTO screeners (id, name, filters, sort_field, sort_direction)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    JSON.stringify(filters || []),
    sortField || "marketCap",
    sortDirection || "desc"
  );

  const screener = db.query("SELECT * FROM screeners WHERE id = ?").get(id) as Record<string, unknown>;

  return c.json(
    {
      ...screener,
      filters: JSON.parse(screener.filters as string),
    },
    201
  );
});

// ---------- PUT /screeners/:id ----------
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { name, filters, sortField, sortDirection } = body;

  const existing = db.query("SELECT * FROM screeners WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Screener not found" }, 404);
  }

  db.query(
    `UPDATE screeners SET
      name = COALESCE(?, name),
      filters = COALESCE(?, filters),
      sort_field = COALESCE(?, sort_field),
      sort_direction = COALESCE(?, sort_direction),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name || null,
    filters ? JSON.stringify(filters) : null,
    sortField || null,
    sortDirection || null,
    id
  );

  const updated = db.query("SELECT * FROM screeners WHERE id = ?").get(id) as Record<string, unknown>;
  return c.json({
    ...updated,
    filters: JSON.parse(updated.filters as string),
  });
});

// ---------- DELETE /screeners/:id ----------
app.delete("/:id", (c) => {
  const id = c.req.param("id");
  db.query("DELETE FROM screeners WHERE id = ?").run(id);
  return c.json({ success: true });
});

export default app;
