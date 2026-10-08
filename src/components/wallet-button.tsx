import { walletEnabled } from "@/lib/wallet";
import { walletWalletEnabled } from "@/lib/walletwallet";

/**
 * "Add to Wallet" for a ticket (t), member pass (p) or guest pass (g). Uses
 * WalletWallet when it's set up (Apple and Google Wallet); otherwise falls back to the
 * own-certificate Apple Wallet ticket, which only exists for tickets.
 */
export function WalletButton({ kind, token, className = "wallet-btn" }: { kind: "t" | "p" | "g"; token: string; className?: string }) {
  if (walletWalletEnabled()) {
    return (
      <a className={className} href={`/wallet/${kind}/${token}`}>
        Add to Apple or Google Wallet
      </a>
    );
  }
  if (kind === "t" && walletEnabled()) {
    return (
      <a className={className} href={`/t/${token}/wallet.pkpass`}>
        Add to Apple Wallet
      </a>
    );
  }
  return null;
}
