import type { Setlist } from '../types'

/**
 * Сети, створені до появи блоків, зберігали плоский список пісень.
 * Складаємо їх в один безіменний блок, щоб нічого не загубилось.
 */
export function withBlocks(setlist: Setlist): Setlist {
  if (setlist.blocks?.length || !setlist.items?.length) {
    return { ...setlist, blocks: setlist.blocks ?? [] }
  }
  return {
    ...setlist,
    blocks: [{ id: `${setlist.id}_block`, title: '', items: setlist.items }],
    items: undefined,
  }
}

export function migrateSetlists(setlists: Setlist[]): Setlist[] {
  return setlists.map(withBlocks)
}
