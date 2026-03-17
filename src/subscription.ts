import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

const KEYWORDS = [
  'firefly',
  'bring back firefly',
  '#bringbackfirefly',
  '#firefly',
]

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    for (const create of ops.posts.creates) {
      console.log("INDEXING:", create.record.text)
    }


    const postsToDelete = ops.posts.deletes.map((del) => del.uri)

    const postsToCreate = ops.posts.creates
      .filter((create) => {
        const text = (create.record.text ?? '').toLowerCase()
        return KEYWORDS.some((k) => text.includes(k))
      })
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
          text: create.record.text ?? null,   // <-- requires DB column + schema update
        }
      })

      console.log('MATCHED POSTS:', postsToCreate.length)

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