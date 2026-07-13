import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CATEGORIES,
  emailToUsername,
  getPermissions,
  requirePermission,
  supabaseAdmin,
  usernameToEmail,
  type PermissionMap,
} from "./_lib/auth.js";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { teamMembers } from "../db/schema.js";

// ============== TEAM MANAGEMENT ==============
// (Vormals: api/team.ts)

function cleanTeam(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSortOrder(value: unknown) {
  const sortOrder = Number(value);
  return Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 10000
    ? sortOrder
    : 10;
}

async function handleTeamGet(req: VercelRequest, res: VercelResponse) {
  const response = await db.query.teamMembers.findMany({
    orderBy: asc(teamMembers.sortOrder),
  });
  const cleanedResponse = response.map((item) => ({
    ...item,
    sortOrder: item.sortOrder ?? 10,
  }));
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  res.status(200).json(cleanedResponse);
}

async function handleTeamPost(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "team", "edit");
  if (!user) return;

  const body =
    typeof req.body === "object" && req.body !== null ? req.body : {};

  const name = cleanTeam(body.name);
  if (!name) return void res.status(400).json({ error: "name required" });

  const role = cleanTeam(body.role);
  const expertise = cleanTeam(body.expertise);
  const description = cleanTeam(body.description);
  const sortOrder = cleanSortOrder(body.sortOrder);

  const newTeamMember = await db.insert(teamMembers).values({
    name,
    role,
    expertise,
    description,
    sortOrder,
  });

  res.status(201).json(newTeamMember);
}

async function handleTeamPatch(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "team", "edit");
  if (!user) return;

  const body =
    typeof req.body === "object" && req.body !== null ? req.body : {};
  const id = Number(req.query.id);

  if (!id) return void res.status(400).json({ error: "id required" });

  const name = cleanTeam(body.name);
  if (!name) return void res.status(400).json({ error: "name required" });

  const role = cleanTeam(body.role);
  const expertise = cleanTeam(body.expertise);
  const description = cleanTeam(body.description);
  const sortOrder = cleanSortOrder(body.sortOrder);

  const updatedRow = await db
    .update(teamMembers)
    .set({ name, role, expertise, description, sortOrder })
    .where(eq(teamMembers.id, id));

  res.status(200).json(updatedRow);
}

async function handleTeamDelete(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "team", "edit");
  if (!user) return;

  const id = Number(req.query.id);
  if (!id) return void res.status(400).json({ error: "id required" });

  const deletedRow = await db
    .delete(teamMembers)
    .where(eq(teamMembers.id, id));

  res.status(200).json(deletedRow);
}

// ============== USERS MANAGEMENT ==============
// (Vormals: api/users.ts)

function cleanUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanPermissions(value: unknown): PermissionMap {
  const result: PermissionMap = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  const obj = value as Record<string, unknown>;
  for (const category of CATEGORIES) {
    const perm = obj[category];
    if (perm === "none" || perm === "view" || perm === "edit") {
      result[category as keyof PermissionMap] = perm;
    }
  }
  return result;
}

async function handleUsersGet(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "users", "view");
  if (!user) return;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      console.error(error);
      return void res.status(500).json({ error: "Failed to fetch users" });
    }

    const usersData = await Promise.all(
      data.users.map(async (authUser) => ({
        ...authUser,
        username: emailToUsername(authUser.email || ""),
        permissions: await getPermissions(authUser.id),
      }))
    );

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    res.status(200).json(usersData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

async function handleUsersPost(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "users", "edit");
  if (!user) return;

  const body =
    typeof req.body === "object" && req.body !== null ? req.body : {};
  const username = cleanUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";

  if (!username)
    return void res.status(400).json({ error: "username required" });
  if (!password)
    return void res.status(400).json({ error: "password required" });

  const permissions = cleanPermissions(body.permissions);

  const email = usernameToEmail(username);

  try {
    const { data: newUser, error } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (error) {
      console.error(error);
      return void res.status(400).json({ error: error.message });
    }

    const userId = newUser.user.id;

    // Save custom claims/permissions
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { permissions },
      }
    );

    if (updateError) {
      console.error(updateError);
      return void res.status(500).json({ error: "Could not save permissions" });
    }

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function handleUsersPatch(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "users", "edit");
  if (!user) return;

  const body =
    typeof req.body === "object" && req.body !== null ? req.body : {};
  const userId = typeof body.userId === "string" ? body.userId : "";
  const password = typeof body.password === "string" ? body.password : "";
  const permissions = cleanPermissions(body.permissions);

  if (!userId) return void res.status(400).json({ error: "userId required" });

  try {
    let updatedUser;

    if (password) {
      const { data: result, error } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          user_metadata: { permissions },
        });

      if (error) {
        console.error(error);
        return void res.status(400).json({ error: error.message });
      }
      updatedUser = result.user;
    } else {
      const { data: result, error } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { permissions },
        });

      if (error) {
        console.error(error);
        return void res.status(400).json({ error: error.message });
      }
      updatedUser = result.user;
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function handleUsersDelete(req: VercelRequest, res: VercelResponse) {
  const user = await requirePermission(req, "users", "edit");
  if (!user) return;

  const userId = typeof req.query.userId === "string" ? req.query.userId : "";

  if (!userId)
    return void res.status(400).json({ error: "userId required" });

  try {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    res.status(204).send("");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ============== MAIN HANDLER ==============

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const target = req.query.target as string || "users";

  if (target === "team") {
    if (req.method === "GET") return handleTeamGet(req, res);
    if (req.method === "POST") return handleTeamPost(req, res);
    if (req.method === "PATCH") return handleTeamPatch(req, res);
    if (req.method === "DELETE") return handleTeamDelete(req, res);
  } else if (target === "users") {
    if (req.method === "GET") return handleUsersGet(req, res);
    if (req.method === "POST") return handleUsersPost(req, res);
    if (req.method === "PATCH") return handleUsersPatch(req, res);
    if (req.method === "DELETE") return handleUsersDelete(req, res);
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
