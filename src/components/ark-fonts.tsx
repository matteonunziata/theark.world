/**
 * The public site's type (Playfair Display and DM Sans), for pages that
 * follow theark.world rather than the staff app. React hoists the link into
 * <head>. Pair with the `ark-type` class (ark-app.css).
 */
export function ArkFonts() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      rel="stylesheet"
      precedence="default"
      href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
    />
  );
}
