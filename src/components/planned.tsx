import Link from "next/link";
import { MODULES, type ModuleKey } from "@/lib/roles";

export function Planned({ module, text }: { module: ModuleKey; text?: string }) {
  const m = MODULES.find((x) => x.key === module);
  return (
    <div className="page">
      <div className="planned">
        <span className="tag">Not built yet</span>
        <h1>{m?.name}</h1>
        <p>
          {text ?? m?.planned ?? "This module is next in the build order."} It
          will use the team and divisions you set up in Settings.
        </p>
        <Link className="btn primary" href="/settings">
          Go to Settings
        </Link>
      </div>
    </div>
  );
}
