// Entry point for secure offline downloads. All logic lives in handler.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(createHandler({
  svc,
  env: (name) => Deno.env.get(name),
  waitUntil: typeof EdgeRuntime !== "undefined" ? (p) => EdgeRuntime.waitUntil(p) : undefined,
}));
