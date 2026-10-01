export const DELIVERY_FREQUENCY_OPTIONS = [
  { id: "WEEKLY", label: "Weekly", deliveriesPerMonth: 4 },
  { id: "FORTNIGHTLY", label: "Every 2 weeks", deliveriesPerMonth: 2 },
  { id: "MONTHLY", label: "Monthly", deliveriesPerMonth: 1 },
] as const;

export const DELIVERY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DELIVERY_WINDOWS = [
  "8:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "12:00 PM – 2:00 PM",
  "2:00 PM – 4:00 PM",
  "4:00 PM – 6:00 PM",
] as const;