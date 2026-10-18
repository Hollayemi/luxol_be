export const MEAT_BOX_DELIVERY_FREQUENCIES = [
  { id: "ONE_TIME", label: "One-Time", recurring: false },
  { id: "WEEKLY", label: "Weekly", recurring: true },
  { id: "EVERY_2_WEEKS", label: "Every 2 weeks", recurring: true },
  { id: "MONTHLY", label: "Monthly", recurring: true },
] as const;

export const MEAT_BOX_DELIVERY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const MEAT_BOX_DELIVERY_WINDOWS = [
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 1:00 PM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM",
] as const;

/** Default cap on quantity per order when option.maxQuantity is null. */
export const MEAT_BOX_DEFAULT_MAX_QUANTITY = 10;