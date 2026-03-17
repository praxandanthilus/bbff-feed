import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

export const shortname = 'bring-back-firefly'

const KEYWORDS = [
  'firefly',
  'serenity'
  'bring back firefly',
  '#BrowncoatsUnite'
  '#bringbackfirefly',
  '#firefly',
]

export async function handler(
  ctx: AppContext,
  params: QueryParams,
): Promise<AlgoOutput> {
  const limit = params.limit ?? 50

  const posts = await ctx.db
    .selectFrom('post')
    .select(['uri', 'text', 'indexedAt'])
    .orderBy('indexedAt', 'desc')
    .limit(500) // look at recent posts
    .execute()

  const filtered = posts
    .filter(p =>
      KEYWORDS.some(k =>
        p.text?.toLowerCase().includes(k),
      ),
    )
    .slice(0, limit)
    .map(p => ({ post: p.uri }))

  return {
    feed: filtered,
  }
}
