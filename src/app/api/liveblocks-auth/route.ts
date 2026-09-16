import { Liveblocks } from "@liveblocks/node";
import { getRandomUser } from "@/legacy/database";

// Authenticating your Liveblocks application
// https://liveblocks.io/docs/authentication
//
// Legacy (2025 prototype) only. LIVEBLOCKS_SECRET_KEY is optional: without it
// this route answers 503 and the legacy client stays disconnected.

export async function POST() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return new Response("LIVEBLOCKS_SECRET_KEY is not configured", {
      status: 503,
    });
  }

  const liveblocks = new Liveblocks({ secret });

  // Get the current user's unique id and info from your database
  const user = getRandomUser();

  // Create a session for the current user
  // userInfo is made available in Liveblocks presence hooks, e.g. useOthers
  const session = liveblocks.prepareSession(`${user.id}`, {
    userInfo: user.info,
  });

  // Use a naming pattern to allow access to rooms with a wildcard
  session.allow(`liveblocks:examples:*`, session.FULL_ACCESS);

  // Authorize the user and return the result
  const { body, status } = await session.authorize();
  return new Response(body, { status });
}
