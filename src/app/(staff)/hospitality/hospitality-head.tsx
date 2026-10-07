import { Tabs } from "@/components/tabs";

export function HospitalityHead() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hospitality</h1>
          <p className="lede">
            Homes in the active stewardship programme: who’s staying, who’s
            arriving, and which homes are free.
          </p>
        </div>
      </div>
      <Tabs
        label="Hospitality sections"
        items={[
          { href: "/hospitality", label: "Bookings" },
          { href: "/hospitality/listings", label: "Listings" },
          { href: "/hospitality/food", label: "Food and beverage" },
        ]}
      />
    </>
  );
}
