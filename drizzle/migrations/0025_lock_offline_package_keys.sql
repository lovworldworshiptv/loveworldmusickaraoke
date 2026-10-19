REVOKE ALL ON public.offline_package_keys FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.offline_devices, public.offline_licences, public.offline_packages FROM anon, authenticated;
REVOKE ALL ON public.offline_devices, public.offline_licences FROM anon;