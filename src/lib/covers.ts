/** A cover photo's address. Uploads are paths in the public `covers` bucket;
 * photos that ship with the site (`/classes/…`) or live elsewhere (`https://…`)
 * are used as they are. */
export const coverUrl = (path: string | null | undefined) =>
  !path
    ? null
    : path.startsWith("/") || path.startsWith("https://")
      ? path
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${path}`;

/** A member's profile photo (public `avatars` bucket). */
export const avatarUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}` : null;
