/**
 * Session plumbing shared by the Better Auth server config and the platform's
 * `bos/link` route.
 *
 * `SESSION_COOKIE` is the dot-less name this system issues its own session
 * under. Better Auth defaults to `better-auth.session_token`, which the platform
 * proxy refuses (its discovery regex is `/^[A-Za-z0-9_-]+$/`), so the name is
 * declared here by shape and read from this file by
 * `src/core/org-vault/system-sources.ts`.
 */
export const SESSION_COOKIE = "cl_session";

/**
 * The value Better Auth signs its session cookies with.
 *
 * A platform-hosted clone is started with `BOS_GATEWAY_SECRET` and never with
 * `BETTER_AUTH_SECRET`, while a standalone demo is the reverse. Falling back
 * from one to the other means the same signing key is used both by this
 * process' Better Auth and by the `bos/link` route that mints a cookie for it.
 */
export function authSecret(): string | undefined {
  return process.env.BETTER_AUTH_SECRET ?? process.env.BOS_GATEWAY_SECRET;
}

/**
 * The path this copy is mounted under: the org clone at `/{org}/clothing`, the
 * demo at `/demo/clothing`, and `/clothing` when run by hand. Better Auth and
 * the link route both scope the session cookie to it, so a cookie minted for one
 * clone is never sent to a sibling mount on the same origin.
 */
export function systemBasePath(): string {
  return process.env.SYSTEM_BASE_PATH ?? "/clothing";
}
