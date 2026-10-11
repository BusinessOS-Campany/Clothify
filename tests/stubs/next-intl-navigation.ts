/**
 * Test stub for `next-intl/navigation`. Avoids loading `next/navigation`, which
 * cannot be resolved outside a running Next.js app.
 */
export const createNavigation = () => ({
  Link: () => null,
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
  getPathname: () => "",
});

export const defineRouting = (config: unknown) => config;
