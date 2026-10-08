import { pass2uEnabled } from "@/lib/pass2u";
import { walletEnabled } from "@/lib/wallet";

/**
 * "Add to Wallet" for a ticket (t), member pass (p) or guest pass (g). Uses
 * Pass2U when it's set up (Apple and Google Wallet); otherwise falls back to the
 * own-certificate Apple Wallet ticket, which only exists for tickets.
 */
export function WalletButton({ kind, token }: { kind: "t" | "p" | "g"; token: string }) {
  if (pass2uEnabled()) {
    return (
      <a className="wallet-btn" href={`/wallet/${kind}/${token}`}>
        Add to Apple or Google Wallet
      </a>
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
