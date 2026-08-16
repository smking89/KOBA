import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { parseFeedQuery } from "@/features/social/schemas/social.schemas";
import { listFeed, listProfilePosts } from "@/features/social/services/post.service";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const query = parseFeedQuery(Object.fromEntries(url.searchParams.entries()));
  try {
    const feed = query.handle
      ? await listProfilePosts({
          handle: query.handle,
          viewerUserId: session?.user.id,
          page: query.cursor ? Number(query.cursor) || 1 : 1,
          pageSize: query.pageSize,
        })
      : await listFeed({
          viewerUserId: session?.user.id,
          cursor: query.cursor,
          pageSize: query.pageSize,
          groupSlug: query.group,
        });
    return NextResponse.json(feed);
  } catch (error) {
    return jsonSocialError(error, "Could not load the feed.");
  }
}
