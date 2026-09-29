# Project Architecture

- Use `src/integrations/external-supabase/client.ts` for all browser auth and data access because this app is connected to the owner's external Supabase project rather than Lovable Cloud.
