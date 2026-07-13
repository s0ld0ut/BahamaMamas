import type { VercelRequest, VercelResponse } from "@vercel/node";
import { emailToUsername, getPermissions, requireLogin } from "./_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method not allowed");
  }

  const user = await requireLogin(req, res);
  if (!user) return;

  return res.status(200).json({
    username: emailToUsername(user.email || "", user.app_metadata as any),
    permissions: getPermissions(user),
  });
}
