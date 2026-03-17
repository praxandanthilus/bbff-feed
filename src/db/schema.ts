export type DatabaseSchema = {
  post: Post
  sub_state: SubState
}

export type Post = {
  uri: string
  cid: string
  indexedAt: string
  text: string | null
}

export type SubState = {
  service: string
  cursor: number
}
