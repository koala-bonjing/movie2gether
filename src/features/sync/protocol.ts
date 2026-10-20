import { z } from 'zod';

export const SyncMsgSchema = z.object({
  seq: z.number(),
  from: z.string(),
  playing: z.boolean(),
  pos: z.number(),
  rate: z.number().default(1),
  at: z.number(),
  heartbeat: z.boolean().optional(),
});
export type SyncMsg = z.infer<typeof SyncMsgSchema>;

export const ClockPingSchema = z.object({
  kind: z.literal('ping'),
  id: z.string(),
  from: z.string(),
  t0: z.number(),
});

export const ClockPongSchema = z.object({
  kind: z.literal('pong'),
  id: z.string(),
  from: z.string(),
  t0: z.number(),
  t1: z.number(),
});

export const ClockMsgSchema = z.discriminatedUnion('kind', [ClockPingSchema, ClockPongSchema]);
export type ClockMsg = z.infer<typeof ClockMsgSchema>;

export const MediaMsgSchema = z.object({
  from: z.string(),
  name: z.string(),
  size: z.number().nonnegative(),
  duration: z.number(),
  hash: z.string(),
});
export type MediaMsg = z.infer<typeof MediaMsgSchema>;

export const BufferMsgSchema = z.object({
  from: z.string(),
  buffering: z.boolean(),
});
export type BufferMsg = z.infer<typeof BufferMsgSchema>;

export const ChatMsgSchema = z.object({
  id: z.string(),
  from: z.string(),
  text: z.string().min(1).max(2000),
  at: z.number(),
});
export type ChatMsg = z.infer<typeof ChatMsgSchema>;

export const SignalMsgSchema = z.object({
  from: z.string(),
  to: z.string(),
  data: z.union([
    z.object({
      type: z.literal('description'),
      description: z.record(z.string(), z.unknown()),
    }),
    z.object({
      type: z.literal('candidate'),
      candidate: z.record(z.string(), z.unknown()).nullable(),
    }),
  ]),
});
export type SignalMsg = z.infer<typeof SignalMsgSchema>;

export function safeParseSyncMsg(data: unknown): SyncMsg | null {
  const result = SyncMsgSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseClockMsg(data: unknown): ClockMsg | null {
  const result = ClockMsgSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseMediaMsg(data: unknown): MediaMsg | null {
  const result = MediaMsgSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseBufferMsg(data: unknown): BufferMsg | null {
  const result = BufferMsgSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseChatMsg(data: unknown): ChatMsg | null {
  const result = ChatMsgSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseSignalMsg(data: unknown): SignalMsg | null {
  const result = SignalMsgSchema.safeParse(data);
  return result.success ? result.data : null;
}
