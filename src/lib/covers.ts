export const coverUrl = (path: string | null | undefined) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${path}`
    : null;
