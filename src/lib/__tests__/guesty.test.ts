import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  blockRange,
  channelLabel,
  parseListing,
  parseReservation,
  parseWebhook,
  stayStatus,
  timeOfDay,
  verifySignature,
} from "../guesty-map";

const reservation = {
  _id: "r1",
  status: "confirmed",
  checkInDateLocalized: "2026-11-02",
  checkOutDateLocalized: "2026-11-06",
  listingId: "l1",
  guestId: "g1",
  guest: { _id: "g1", fullName: "Ana Rojas", email: "Ana@Example.com ", phone: "+506 8888 0000" },
  money: { totalPrice: 480, currency: "usd", balanceDue: 0, isFullyPaid: true },
  source: "airbnb2",
  platform: "airbnb2",
  confirmationCode: "HMABC123",
  guestsCount: 2,
  lastUpdatedAt: "2026-10-05T12:00:00.000Z",
};

describe("reservations", () => {
  it("takes the fields a stay needs", () => {
    expect(parseReservation(reservation)).toEqual({
      id: "r1",
      listingId: "l1",
      guestId: "g1",
      status: "confirmed",
      checkIn: "2026-11-02",
      checkOut: "2026-11-06",
      guestName: "Ana Rojas",
      email: "ana@example.com",
      phone: "+506 8888 0000",
      guests: 2,
      total: 480,
      currency: "USD",
      paid: true,
      channel: "Airbnb",
      confirmationCode: "HMABC123",
      updatedAt: "2026-10-05T12:00:00.000Z",
    });
  });

  it("falls back to UTC dates, first and last names, and guest counts by type", () => {
    const r = parseReservation({
      _id: "r2",
      status: "reserved",
      checkIn: "2026-12-20T20:00:00.000Z",
      checkOut: "2026-12-24T16:00:00.000Z",
      guest: { firstName: "Luis", lastName: "Mora" },
      numberOfGuests: { numberOfAdults: 2, numberOfChildren: 1, numberOfInfants: 1 },
      money: { balanceDue: 120 },
    });
    expect(r?.checkIn).toBe("2026-12-20");
    expect(r?.checkOut).toBe("2026-12-24");
    expect(r?.guestName).toBe("Luis Mora");
    expect(r?.guests).toBe(3);
    expect(r?.paid).toBe(false);
    expect(r?.channel).toBeNull();
  });

  it("needs an id", () => {
    expect(parseReservation({ status: "confirmed" })).toBeNull();
    expect(parseReservation("nope")).toBeNull();
  });
});

describe("status and channel", () => {
  it("maps Guesty statuses onto stay statuses", () => {
    expect(stayStatus("confirmed")).toBe("confirmed");
    expect(stayStatus("checked_in")).toBe("confirmed");
    expect(stayStatus("reserved")).toBe("inquiry");
    expect(stayStatus("awaiting_payment")).toBe("inquiry");
    expect(stayStatus("canceled")).toBe("cancelled");
    expect(stayStatus("declined")).toBe("cancelled");
    expect(stayStatus("something_new")).toBeNull();
  });

  it("names channels plainly", () => {
    expect(channelLabel("airbnb2", null)).toBe("Airbnb");
    expect(channelLabel("bookingCom", null)).toBe("Booking.com");
    expect(channelLabel(null, "manual")).toBe("Guesty");
    expect(channelLabel(null, "guesty-booking-engine")).toBe("Booking site");
    expect(channelLabel("vrbo", null)).toBe("Vrbo");
    expect(channelLabel(null, null)).toBeNull();
  });
});

describe("listings", () => {
  it("takes rate, rooms and times", () => {
    expect(
      parseListing({
        _id: "l1",
        title: "Beehive 1",
        nickname: "BH1",
        active: true,
        isListed: false,
        accommodates: 2,
        bedrooms: 1,
        bathrooms: 1,
        beds: 2,
        prices: { basePrice: 120, currency: "USD", cleaningFee: 30 },
        terms: { minNights: 2 },
        defaultCheckInTime: "15:00",
        defaultCheckOutTime: "11:00",
        picture: { thumbnail: "https://x/t.jpg", original: "https://x/o.jpg" },
      }),
    ).toEqual({
      id: "l1",
      title: "Beehive 1",
      nickname: "BH1",
      active: true,
      listed: false,
      accommodates: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      base_price: 120,
      currency: "USD",
      cleaning_fee: 30,
      min_nights: 2,
      check_in_time: "15:00",
      check_out_time: "11:00",
      cover_url: "https://x/o.jpg",
    });
  });

  it("turns Guesty's times into Postgres times", () => {
    expect(timeOfDay("15:00")).toBe("15:00:00");
    expect(timeOfDay("9:30:00")).toBe("09:30:00");
    expect(timeOfDay("25:00")).toBeNull();
    expect(timeOfDay(null)).toBeNull();
  });
});

describe("calendar", () => {
  it("blocks nights, not the check-out day", () => {
    expect(blockRange("2026-11-02", "2026-11-06")).toEqual({ startDate: "2026-11-02", endDate: "2026-11-05" });
    expect(blockRange("2026-12-31", "2027-01-01")).toEqual({ startDate: "2026-12-31", endDate: "2026-12-31" });
  });
});

describe("webhooks", () => {
  it("reads v2 events, which only carry ids", () => {
    expect(
      parseWebhook({ event: "reservation.updated.v2", meta: { eventId: "e1" }, data: { reservationId: "r9", status: "canceled" } }),
    ).toEqual({ event: "reservation.updated.v2", reservationId: "r9", reservation: null });
  });

  it("reads legacy events, which carry the reservation", () => {
    const w = parseWebhook({ event: "reservation.new", reservation });
    expect(w?.reservationId).toBe("r1");
    expect(w?.reservation?.guestName).toBe("Ana Rojas");
  });

  it("verifies Svix signatures", () => {
    const secret = `whsec_${Buffer.from("top-secret-key").toString("base64")}`;
    const body = '{"event":"reservation.created.v2"}';
    const now = 1_760_000_000_000;
    const timestamp = String(Math.floor(now / 1000));
    const sig = createHmac("sha256", Buffer.from("top-secret-key")).update(`msg_1.${timestamp}.${body}`).digest("base64");
    const headers = { id: "msg_1", timestamp, signature: `v1,${sig}` };
    expect(verifySignature(secret, headers, body, now)).toBe(true);
    expect(verifySignature(secret, { ...headers, signature: `v1,${sig.slice(0, -2)}AA` }, body, now)).toBe(false);
    expect(verifySignature(secret, headers, `${body} `, now)).toBe(false);
    expect(verifySignature(secret, headers, body, now + 10 * 60_000)).toBe(false);
    expect(verifySignature(secret, { ...headers, signature: null }, body, now)).toBe(false);
  });
});
