import "server-only";

/**
 * Apple Wallet needs a Pass Type ID certificate from an Apple Developer
 * account. Until these env vars are set, the button stays hidden.
 */
export const walletEnabled = () =>
  !!(
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_CERT &&
    process.env.APPLE_PASS_KEY &&
    process.env.APPLE_WWDR_CERT
  );

/** Env vars hold PEM files base64-encoded so they fit on one line. */
export const pem = (name: string) =>
  Buffer.from(process.env[name] ?? "", "base64").toString("utf8");
