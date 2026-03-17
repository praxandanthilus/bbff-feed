import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

export const shortname = 'bring-back-firefly'

const KEYWORDS = [
  'firefly',
  'bring back firefly',
  '#bringbackfirefly',
  '#firefly',
]

function makeCursor(indexedAt: string, uri: string) {
  return `${indexedAt}::${uri}`
}

function parseCursor(cursor?: string | null) {
  if (!cursor) return null
  const parts = cursor.split('::')
  if (parts.length !== 2) return null
  return { indexedAt: parts[0], uri: parts[1] }
}

function normalizeText(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesKeywords(text: string): boolean {
  return KEYWORDS.some((k) => text.includes(k))
}

export async function handler(
  ctx: AppContext,
  params: QueryParams,
): Promise<AlgoOutput> {
  const limit = Math.min(params.limit ?? 50, 100)
  const initialCursor = parseCursor(params.cursor)

  const feed: { post: string }[] = []
  const chunkSize = 500

  let scanCursor: { indexedAt: string; uri: string } | null = initialCursor
  let nextCursor: string | undefined

  while (feed.length < limit) {
    let q = ctx.db
      .selectFrom('post')
      .select(['uri', 'indexedAt', 'text'])
      .orderBy('indexedAt', 'desc')
      .orderBy('uri', 'desc')
      .limit(chunkSize)

    // ✅ Fix TS18047 by snapshotting the cursor
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
      const text = normalizeText(r.text)
      if (matchesKeywords(text)) {
        feed.push({ post: r.uri })
        nextCursor = makeCursor(r.indexedAt, r.uri)
        if (feed.length >= limit) break
      }

      // advance scanning cursor regardless, so we keep moving backward
      scanCursor = { indexedAt: r.indexedAt, uri: r.uri }
    }

    if (feed.length >= limit) break
  }

  return {
    feed,
    cursor: nextCursor,
  }
}