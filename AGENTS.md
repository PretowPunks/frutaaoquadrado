# Project Architecture

- Use `src/integrations/external-supabase/client.ts` for all browser auth and data access because this app is connected to the owner's external Supabase project rather than Lovable Cloud.
- Keep installation manifest-only, without a service worker, because the app needs home-screen branding but not offline caching.
- Complete native Google OAuth through `com.fruta2.gerenciador://auth`, because Android must return from the system browser to the installed app.
