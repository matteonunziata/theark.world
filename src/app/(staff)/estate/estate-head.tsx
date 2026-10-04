import { Tabs } from "@/components/tabs";

export function EstateHead() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Real estate</h1>
          <p className="lede">
            Every lot on the land: what’s available, who owns what, the homes,
            and the families who live in them.
          </p>
        </div>
      </div>
      <Tabs
        label="Real estate sections"
        items={[
          { href: "/estate", label: "Inventory" },
          { href: "/estate/map", label: "Map" },
        ]}
      />
    </>
  );
}
