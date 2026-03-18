import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

// Require ANY ONE of these hashtags (case-insensitive), as real hashtag tokens.
const REQUIRED_HASHTAGS = [
  'bringbackfirefly',
  'browncoatsunite',
  'cabrowncoats',
]

// Matches a real hashtag token like "#bringbackfirefly" with word boundary-ish behavior.
// This avoids false positives like "sad_firefly_4890" (not a hashtag token).
function hasAnyRequiredHashtag(raw: string | null | undefined): boolean {
  const text = (raw ?? '').toLowerCase()
  return REQUIRED_HASHTAGS.some((tag) =>
    new RegExp(`(^|\\s)#${tag}(\\b|$)`, 'i').test(text),
  )
}

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)

    const postsToCreate = ops.posts.creates
      .filter((create) => hasAnyRequiredHashtag(create.record.text))
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
          text: create.record.text ?? null,
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }

    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}