import { HospitalityHead } from "../hospitality-head";
import { Tabs } from "@/components/tabs";

export function FoodHead() {
  return (
    <>
      <HospitalityHead />
      <Tabs
        label="Food and beverage sections"
        items={[
          { href: "/hospitality/food", label: "Meal tickets" },
          { href: "/hospitality/food/inventory", label: "Inventory" },
        ]}
      />
    </>
  );
}
