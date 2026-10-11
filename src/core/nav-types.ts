/** Minimal user shape required for authorization decisions. */
export type AuthUserShape = {
  id: string;
  roleId?: string;
  isPlatformAdmin?: boolean;
};