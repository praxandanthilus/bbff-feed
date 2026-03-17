import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

export const shortname = 'bring-back-firefly'

// Cursor format: "<indexedAt>::<uri>"
function makeCursor(indexedAt: string, uri: string) {
  return `${indexedAt}::${uri}`
}

function parseCursor(cursor?: string | null) {
  if (!cursor) return null
  const parts = cursor.split('::')
  if (parts.length !== 2) return null
  return { indexedAt: parts[0], uri: parts[1] }
}

export async function handler(
  ctx: AppContext,
  params: QueryParams,
): Promise<AlgoOutput> {
  const limit = Math.min(params.limit ?? 50, 100) // API allows up to 100 [2](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed-skeleton)
  const cursor = parseCursor(params.cursor)

  let q = ctx.db
    .selectFrom('post')
    .select(['uri', 'indexedAt'])
    .orderBy('indexedAt', 'desc')
    .orderBy('uri', 'desc')
    .limit(limit + 1)

  // Cursor pagination: fetch “older than” the cursor row
  if (cursor) {
    q = q.where((eb) =>
      eb.or([
        eb('indexedAt', '<', cursor.indexedAt),
        eb.and([eb('indexedAt', '=', cursor.indexedAt), eb('uri', '<', cursor.uri)]),
      ]),
    )
  }

  const rows = await q.execute()

  const page = rows.slice(0, limit)
  const next = rows.length > limit ? rows[limit] : undefined

  return {
    feed: page.map((r) => ({ post: r.uri })),
    cursor: next ? makeCursor(next.indexedAt, next.uri) : undefined,
  }
}