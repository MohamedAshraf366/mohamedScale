/**
 * Audit-log request grouping helper (Phase 1b).
 *
 * The `activity_log.request_id` column lets multiple writes from a single
 * user action be grouped together in the timeline UI. This module gives you
 * two ways to populate it:
 *
 * 1. `newRequestId()` — generate a UUID once per user action and pass it
 *    explicitly to whatever code does the writes. Useful when writes go
 *    through an RPC / edge function, where you can call `set_request_id`
 *    at the start of the same DB session before the inserts run.
 *
 * 2. `withRequestId(rpcName, args)` — sugar for "call set_request_id then
 *    invoke this RPC", since both calls land on the same pooled connection
 *    when wrapped in a single PostgREST RPC. For multi-table client-side
 *    saves that DON'T go through one RPC, the request_id will simply stay
 *    null (current behavior — safe).
 *
 * NOTE: Because PostgREST uses connection pooling, calling
 * `set_request_id()` from the JS client and then doing INSERTs from the
 * JS client separately is NOT guaranteed to land on the same connection.
 * The reliable pattern is to do the writes inside a SQL function that
 * itself calls set_request_id first.
 */
import { supabase } from "@/integrations/supabase/client";

/** Generate a fresh UUID for a single user action / request. */
export function newRequestId(): string {
  // crypto.randomUUID is available in all modern browsers + Node 19+.
  return crypto.randomUUID();
}

/** Set the request_id on the current DB session (best-effort). */
export async function setRequestId(requestId: string): Promise<void> {
  await supabase.rpc("set_request_id", { _request_id: requestId });
}

/** Clear it (best-effort). Call at the end of a multi-step save if you like. */
export async function clearRequestId(): Promise<void> {
  await supabase.rpc("set_request_id", { _request_id: null as unknown as string });
}
