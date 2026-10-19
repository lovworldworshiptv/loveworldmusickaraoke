import { supabase } from "@/integrations/supabase/client";

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any) { super(message); }
}

/** Call the secure offline backend function and surface status codes as ApiError. */
export async function offlineApi<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("offline-media", { body: { action, ...payload } });
  if (error) {
    const ctx = (error as any).context as Response | undefined;
    let body: any = null;
    try { body = ctx ? await ctx.clone().json() : null; } catch { /* not json */ }
    const status = ctx?.status ?? 0;
    throw new ApiError(body?.error || error.message || "Request failed", status, body);
  }
  return data as T;
}
