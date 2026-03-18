import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

export const shortname = 'bring-back-firefly'

// Require ANY ONE of these hashtags (case-insensitive), as real hashtag tokens.
const REQUIRED_HASHTAGS = [
  'bringbackfirefly',
  'browncoatsunite',
  'cabrowncoats',
]

function hasAnyRequiredHashtag(raw: string | null | undefined): boolean {
  const text = (raw ?? '').toLowerCase()
  return REQUIRED_HASHTAGS.some((tag) =>
    new RegExp(`(^|\\s)#${tag}(\\b|$)`, 'i').test(text),
  )
}

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
  // limit must be 1..100 (spec max 100) [1](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed-skeleton)
  const limit = Math.min(params.limit ?? 50, 100)
  const initialCursor = parseCursor(params.cursor)

  const feed: { post: string }[] = []
  const chunkSize = 500

  // Scan older and older rows until we collect `limit` matches.
  let scanCursor: { indexedAt: string; uri: string } | null = initialCursor
  let nextCursor: string | undefined

  while (feed.length < limit) {
    let q = ctx.db
      .selectFrom('post')
      .select(['uri', 'indexedAt', 'text'])
      .orderBy('indexedAt', 'desc')
      .orderBy('uri', 'desc')
      .limit(chunkSize)

    // Snapshot to satisfy strict null checks inside the callback
    const sc = scanCursor
    if (sc) {
      q = q.where((eb) =>
        eb.or([
          eb('indexedAt', '<', sc.indexedAt),
          eb.and([eb('indexedAt', '=', sc.indexedAt), eb('uri', '<', sc.uri)]),
        ]),
      )
    }

    const rows = await q.execute()
    if (rows.length === 0) break

    for (const r of rows) {
      if (hasAnyRequiredHashtag(r.text)) {
        feed.push({ post: r.uri })
        nextCursor = makeCursor(r.indexedAt, r.uri)
        if (feed.length >= limit) break
      }

      // Advance scan cursor regardless, so we keep moving backward
      scanCursor = { indexedAt: r.indexedAt, uri: r.uri }
    }

    if (feed.length >= limit) break
  }

  return {
    feed,
    cursor: nextCursor,
  }
}