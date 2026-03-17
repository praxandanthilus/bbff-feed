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

export async function handler(
  ctx: AppContext,
  params: QueryParams,
): Promise<AlgoOutput> {
  const limit = params.limit ?? 50

  const rows = await ctx.db
    .selectFrom('post')
    .select(['uri', 'text'])
    .orderBy('indexedAt', 'desc')
    .limit(500)
    .execute()

  const feed = rows
    .filter(r =>
      KEYWORDS.some(k =>
        r.text?.toLowerCase().includes(k),
      ),
    )
    .slice(0, limit)
    .map(r => ({ post: r.uri }))

  return { feed }
}