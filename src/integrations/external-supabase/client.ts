import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

export const EXTERNAL_SUPABASE_URL = "https://mgpvnewdfqmzxohtdlou.supabase.co";
export const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_wQRrnkGVCzHktSA39rWOcA_PRvJcLz1";

function externalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
  );

  if (init?.headers) {
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  }

  if (headers.get("Authorization") === `Bearer ${EXTERNAL_SUPABASE_PUBLISHABLE_KEY}`) {
    headers.delete("Authorization");
  }
  headers.set("apikey", EXTERNAL_SUPABASE_PUBLISHABLE_KEY);

  return fetch(input, { ...init, headers });
}

export const supabase = createClient<Database>(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    global: { fetch: externalFetch },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
