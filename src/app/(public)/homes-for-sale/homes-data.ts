// Copied from theark.world/homes-for-sale and its four home pages. Status and asking price come from the real estate inventory when the lot is listed there.
export const HOMES_INTRO = "Discover available residences within The ARK. A rare opportunity to step directly into our regenerative community.";
export const HOMES_HERO = "background-aa4be4.webp";

export type Home = {
  id: string; lot: string; name: string; liveStatus: string; livePrice: string; beds: string; baths: string;
  living: string; lotSize: string; summary: string; about: string; features: string[]; after: string[];
  gallery: string[]; cover: string;
};

export const HOMES: Home[] = [
  {
    "id": "1",
    "lot": "82",
    "name": "Casa Lilith",
    "liveStatus": "SOLD",
    "livePrice": "$1,325,000",
    "beds": "3",
    "baths": "2",
    "living": "232 sqm",
    "lotSize": "Lot 82",
    "summary": "Main house and guesthouse located on Lot 82, featuring a pool, fully equipped kitchens, teak wood finishes, air conditioning, full solar system, and other modern installations. Includes a carport and a 7,000-liter water tank. Furniture is not included in the purchase price but can be negotiated directly with the seller.",
    "about": "Main house and guesthouse located on Lot 82, featuring a pool, fully equipped kitchens, teak wood finishes, air conditioning, full solar system, and other modern installations. Includes a carport and a 7,000-liter water tank. Furniture is not included in the purchase price but can be negotiated directly with the seller.",
    "features": [
      "Main house and guesthouse",
      "Private pool",
      "Fully equipped kitchens",
      "Teak wood finishes",
      "Air conditioning",
      "Full solar system",
      "7,000-liter water tank",
      "Carport"
    ],
    "after": [
      "### Explore More Homes",
      "Discover other beautiful residences currently available within The ARK.",
      "VIEW HOMES"
    ],
    "gallery": [
      "casa-lilith-view-1-9b3508.webp",
      "casa-lilith-view-2-5d6b28.webp",
      "casa-lilith-view-3-be99d1.webp",
      "casa-lilith-view-4-f387fe.webp",
      "casa-lilith-view-5-b27f6c.webp",
      "casa-lilith-view-6-b11e8e.webp"
    ],
    "cover": "casa-lilith-9b3508.webp"
  },
  {
    "id": "2",
    "lot": "9",
    "name": "Casa Trinidad",
    "liveStatus": "AVAILABLE",
    "livePrice": "$1,600,000",
    "beds": "5",
    "baths": "5",
    "living": "500 sqm",
    "lotSize": "1.23 acres",
    "summary": "This brand-new, beautifully designed five-bedroom home sits on 1.23 acres on Lot 9 of The ARK. The property enjoys both ocean and jungle views from the ocean-facing side of the platform and offers exceptional convenience with two access points—one leading to Santa Teresa and the other toward Cobano.",
    "about": "This brand-new, beautifully designed five-bedroom home sits on 1.23 acres on Lot 9 of The ARK. The property enjoys both ocean and jungle views from the ocean-facing side of the platform and offers exceptional convenience with two access points—one leading to Santa Teresa and the other toward Cobano.",
    "features": [
      "Brand-new construction",
      "Ocean and jungle views",
      "Two convenient access points",
      "Large 1.23 acre lot",
      "Spacious outdoor living areas",
      "Modern architectural design",
      "Premium finishes throughout"
    ],
    "after": [
      "### Interested in Casa Trinidad?",
      "Contact our stewardship team to schedule a private viewing or request more information about this property.",
      "I'M INTERESTED"
    ],
    "gallery": [
      "casa-trinidad-view-1-ea481c.webp",
      "casa-trinidad-view-2-53d392.webp",
      "casa-trinidad-view-3-83d1cb.webp",
      "casa-trinidad-view-4-14339c.webp",
      "casa-trinidad-view-5-14372e.webp",
      "casa-trinidad-view-6-4b31ac.webp"
    ],
    "cover": "casa-trinidad-ea481c.webp"
  },
  {
    "id": "3",
    "lot": "10",
    "name": "Tanit Estate",
    "liveStatus": "AVAILABLE",
    "livePrice": "$4,500,000",
    "beds": "7",
    "baths": "6",
    "living": "700 sqm",
    "lotSize": "1.5 hectares",
    "summary": "This exceptional estate features a Main house (5BR) and guesthouse (2BR), offering a blend of elegance and tranquility. Set across 15,000 square meters (1.5 hectares) with breathtaking ocean views, offering an unparalleled living experience at The ARK.",
    "about": "This exceptional estate features a Main house (5BR) and guesthouse (2BR), offering a blend of elegance and tranquility. Set across 15,000 square meters (1.5 hectares) with breathtaking ocean views, offering an unparalleled living experience at The ARK. Designed for those who seek the ultimate in privacy and luxury within a regenerative community setting.",
    "features": [
      "Main house (5BR) and guesthouse (2BR)",
      "Massive 1.5 hectare private estate",
      "Breathtaking panoramic ocean views",
      "Unparalleled privacy",
      "Multiple living and entertainment areas",
      "Expansive outdoor terraces",
      "Luxury finishes and materials",
      "Integration with natural surroundings"
    ],
    "after": [
      "### Interested in Tanit Estate?",
      "Contact our stewardship team to schedule a private viewing or request more information about this property.",
      "I'M INTERESTED"
    ],
    "gallery": [
      "tanit-estate-view-1-e9bea9.webp",
      "tanit-estate-view-2-f303fd.webp",
      "tanit-estate-view-3-3a5e75.webp",
      "tanit-estate-view-4-69197f.webp",
      "tanit-estate-view-5-87f55c.webp",
      "tanit-estate-view-6-e4a3cf.webp"
    ],
    "cover": "tanit-estate-e9bea9.webp"
  },
  {
    "id": "4",
    "lot": "4",
    "name": "Ocean and Mountain View House",
    "liveStatus": "AVAILABLE",
    "livePrice": "$899,000",
    "beds": "3",
    "baths": "3",
    "living": "280 sqm",
    "lotSize": "5,000 sqm",
    "summary": "This brand-newly built house has both an amazing location and gorgeous views. The house measures 280 m² and features three bedrooms and three bathrooms, with an open-plan living and kitchen area that seamlessly opens onto the deck and pool, creating an ideal indoor-outdoor living experience. The property measures 5,000m2 and there is ample space for adding on.",
    "about": "This brand-newly built house has both an amazing location and gorgeous views. The house measures 280 m² and features three bedrooms and three bathrooms, with an open-plan living and kitchen area that seamlessly opens onto the deck and pool, creating an ideal indoor-outdoor living experience. The property measures 5,000m2 and there is ample space for adding on.",
    "features": [
      "Brand-new construction",
      "Ocean and mountain views",
      "Open-plan living and kitchen area",
      "Seamless indoor-outdoor flow",
      "Private deck and pool",
      "Large 5,000m2 lot",
      "Ample space for expansion"
    ],
    "after": [
      "### Interested in Ocean and Mountain View House?",
      "Contact our stewardship team to schedule a private viewing or request more information about this property.",
      "I'M INTERESTED"
    ],
    "gallery": [
      "ocean-and-mountain-view-house-vi-75ef22.webp",
      "ocean-and-mountain-view-house-vi-99011b.webp",
      "ocean-and-mountain-view-house-vi-99c609.webp",
      "ocean-and-mountain-view-house-vi-85c10e.webp",
      "ocean-and-mountain-view-house-vi-0dda86.webp",
      "ocean-and-mountain-view-house-vi-ef4c34.webp"
    ],
    "cover": "ocean-and-mountain-view-house-75ef22.webp"
  }
];
