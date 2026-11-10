import { neon } from "@neondatabase/serverless";
import { getAuth } from "../../../lib/auth-server";

const MAX_FAVORITES = 2000;
const MAX_PLATFORMS = 50;

type PreferencePayload = {
  favoriteIds: string[];
  preferredPlatforms: string[];
  notificationsEnabled: boolean;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");
  return neon(databaseUrl);
}

function cleanStringList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function parsePayload(value: unknown): PreferencePayload {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    favoriteIds: cleanStringList(body.favoriteIds, MAX_FAVORITES),
    preferredPlatforms: cleanStringList(body.preferredPlatforms, MAX_PLATFORMS),
    notificationsEnabled: body.notificationsEnabled === true,
  };
}

async function getUserId() {
  const { data: session } = await getAuth().getSession();
  return session?.user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const sql = getSql();
    const rows = await sql`
      select favorite_offer_ids, preferred_platforms, notifications_enabled, updated_at
      from public.user_preferences
      where user_id = ${userId}::uuid
      limit 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;

    return Response.json({
      preferences: row ? {
        favoriteIds: cleanStringList(row.favorite_offer_ids, MAX_FAVORITES),
        preferredPlatforms: cleanStringList(row.preferred_platforms, MAX_PLATFORMS),
        notificationsEnabled: row.notifications_enabled === true,
        updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
      } : null,
    });
  } catch (error) {
    console.error("[preferences] GET failed", error);
    return Response.json({ error: "PREFERENCES_UNAVAILABLE" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const payload = parsePayload(await request.json());
    const sql = getSql();
    const rows = await sql`
      insert into public.user_preferences (user_id, favorite_offer_ids, preferred_platforms, notifications_enabled, updated_at)
      values (${userId}::uuid, ${JSON.stringify(payload.favoriteIds)}::jsonb, ${JSON.stringify(payload.preferredPlatforms)}::jsonb, ${payload.notificationsEnabled}, now())
      on conflict (user_id) do update set
        favorite_offer_ids = excluded.favorite_offer_ids,
        preferred_platforms = excluded.preferred_platforms,
        notifications_enabled = excluded.notifications_enabled,
        updated_at = now()
      returning updated_at
    `;

    return Response.json({
      ok: true,
      preferences: payload,
      updatedAt: rows[0] && typeof rows[0].updated_at !== "undefined" ? new Date(String(rows[0].updated_at)).toISOString() : null,
    });
  } catch (error) {
    console.error("[preferences] PUT failed", error);
    return Response.json({ error: "PREFERENCES_UNAVAILABLE" }, { status: 500 });
  }
}

