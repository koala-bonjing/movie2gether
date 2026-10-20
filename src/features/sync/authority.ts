/**
 * Conflict and authority resolution (ARCHITECTURE.md §6).
 * No host. Last action wins based on Lamport-style sequence numbers and lexicographical tie-breaking:
 * (seq, from) > (lastAcceptedSeq, lastAcceptedFrom).
 */

export interface ActionAuthority {
  seq: number;
  from: string;
}

export function compareActionAuthority(a: ActionAuthority, b: ActionAuthority): number {
  if (a.seq !== b.seq) {
    return a.seq - b.seq;
  }
  if (a.from < b.from) return -1;
  if (a.from > b.from) return 1;
  return 0;
}

export function shouldAcceptRemoteSync(
  incoming: { seq: number; from: string; heartbeat?: boolean },
  current: ActionAuthority | null,
): boolean {
  if (!current) return true;

  // Heartbeat from current controller with same sequence number
  if (incoming.heartbeat && incoming.from === current.from && incoming.seq === current.seq) {
    return true;
  }

  // Lexicographical comparison: higher seq wins; if seq is tied, higher `from` ID wins
  if (incoming.seq > current.seq) return true;
  if (incoming.seq < current.seq) return false;

  return incoming.from > current.from;
}

export function computeNextLocalSeq(localSeq: number, lastAcceptedSeq: number): number {
  return Math.max(localSeq, lastAcceptedSeq) + 1;
}

export function isController(controllerId: string | null | undefined, selfId: string): boolean {
  return Boolean(controllerId && controllerId === selfId);
}
