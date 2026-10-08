import { headers } from "next/headers";
import { walletEnabled } from "@/lib/wallet";
import { walletWalletEnabled } from "@/lib/walletwallet";

/**
 * "Add to Apple Wallet" / "Add to Google Wallet" for a ticket (t), member pass
 * (p) or guest pass (g). An iPhone sees the Apple button, an Android phone the
 * Google one, anything else both. They go to the same link: WalletWallet's
 * install page puts the pass in whichever wallet the device has. Falls back to
 * the own-certificate Apple Wallet ticket when WalletWallet isn't set up, which
 * only exists for tickets.
 */
export async function WalletButton({ kind, token }: { kind: "t" | "p" | "g"; token: string }) {
  if (walletWalletEnabled()) {
    const ua = (await headers()).get("user-agent") ?? "";
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    const href = `/wallet/${kind}/${token}`;
    return (
      <div className="wallet-badges">
        {!android && (
          <a className="wallet-btn apple" href={href}>
            <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
              <rect x="0" y="3" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M0 8h18" stroke="currentColor" strokeWidth="1.8" />
              <path d="M0 12h18" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Add to Apple Wallet
          </a>
        )}
        {!ios && (
          <a className="wallet-badge" href={href}>
            {/* Google's official badge, unaltered (public/brand/wallet). */}
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG badge */}
            <img src="/brand/wallet/add-to-google-wallet.svg" alt="Add to Google Wallet" height={48} width={174} />
          </a>
        )}
      </div>
    );
  }
  if (kind === "t" && walletEnabled()) {
    return (
      <a className="wallet-btn" href={`/t/${token}/wallet.pkpass`}>
        Add to Apple Wallet
      </a>
    );
  }
  return null;
}
