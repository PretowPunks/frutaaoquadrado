# Project Architecture

- Use `src/integrations/external-supabase/client.ts` for all browser auth and data access because this app is connected to the owner's external Supabase project rather than Lovable Cloud.
- Keep installation manifest-only, without a service worker, because the app needs home-screen branding but not offline caching.
- Handle native Google OAuth through the app deep link while preserving the standard browser redirect on web.
