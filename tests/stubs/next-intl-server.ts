/**
 * Test stub for `next-intl/server`. Integration tests exercise server actions
 * outside of a Next.js request, so the real implementation (which requires the
 * RSC request context) cannot run.
 */
export const getLocale = async () => "en";
export const getTranslations = async () => (key: string) => key;
export const getFormatter = async () => (v: unknown) => String(v);
export const getMessages = async () => ({});
export const getNow = async () => new Date();
export const setRequestLocale = () => {};
export const unstable_setRequestLocale = () => {};
