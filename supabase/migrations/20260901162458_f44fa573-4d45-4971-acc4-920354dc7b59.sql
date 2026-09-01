REVOKE ALL ON FUNCTION public.clone_catalog_for(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clone_catalog_for(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.clone_catalog_for(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clone_catalog_for(uuid) TO service_role;