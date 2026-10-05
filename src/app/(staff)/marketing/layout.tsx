import { requireStaff } from "@/lib/auth";
import { MarketingNav } from "./nav";

export default async function MarketingLayout({ children }: LayoutProps<"/marketing">) {
  await requireStaff("marketing");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Marketing</h1>
          <p className="lede">
            Five brands, one place: the strategy behind each, the content in the works, what’s going
            out on social and email, and what’s working.
          </p>
        </div>
      </div>
      <MarketingNav />
      {children}
    </div>
  );
}
