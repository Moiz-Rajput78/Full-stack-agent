import { Router } from "express";
import { getPool } from "../db/pool.js";

export const debugRouter = Router();

debugRouter.get("/connections-schema", async (_req, res) => {
  try {
    const result = await getPool().query(`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'connections'
      ORDER BY ordinal_position;
    `);

    return res.json({
      table: "connections",
      columns: result.rows,
    });
  } catch (error) {
    console.error("Failed to inspect connections schema:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to inspect database",
    });
  }
});

