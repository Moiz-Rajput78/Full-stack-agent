import { getPool } from "../db/pool.js";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "pending";

export type CurrentConnectionRow = {
  user_id: string;
  provider: "calendar";
  status: ConnectionStatus;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
  scope: string | null;
};

export async function getCalendarConnectionRow(
  userId: string,
) {
  const result = await getPool().query<CurrentConnectionRow>(
    `
      SELECT
        user_id,
        provider,
        status,
        access_token,
        refresh_token,
        expires_at,
        scope
      FROM connections
      WHERE user_id = $1
        AND provider = 'calendar'
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function upsertCalendarConnection(input: {
  userId: string;
  status: ConnectionStatus;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
}) {
  const result = await getPool().query<CurrentConnectionRow>(
    `
      INSERT INTO connections (
        user_id,
        provider,
        status,
        access_token,
        refresh_token,
        expires_at,
        scope
      )
      VALUES (
        $1,
        'calendar',
        $2,
        $3,
        $4,
        $5,
        $6
      )
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        status = EXCLUDED.status,
        access_token = COALESCE(
          EXCLUDED.access_token,
          connections.access_token
        ),
        refresh_token = COALESCE(
          EXCLUDED.refresh_token,
          connections.refresh_token
        ),
        expires_at = COALESCE(
          EXCLUDED.expires_at,
          connections.expires_at
        ),
        scope = COALESCE(
          EXCLUDED.scope,
          connections.scope
        )
      RETURNING
        user_id,
        provider,
        status,
        access_token,
        refresh_token,
        expires_at,
        scope
    `,
    [
      input.userId,
      input.status,
      input.accessToken ?? null,
      input.refreshToken ?? null,
      input.expiresAt ?? null,
      input.scope ?? null,
    ],
  );

  return result.rows[0];
}
