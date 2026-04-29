import type { TourStatus } from "@/lib/types/property";

export const STATUS_COLOR: Record<TourStatus, string> = {
  not_toured: "#a1a1aa",
  called: "#22d3ee",
  scheduled: "#3b82f6",
  toured: "#a78bfa",
  rejected: "#52525b",
  top_pick: "#e879f9",
};

export const STATUS_LABEL: Record<TourStatus, string> = {
  not_toured: "Not toured",
  called: "Called",
  scheduled: "Scheduled",
  toured: "Toured",
  rejected: "Rejected",
  top_pick: "Top pick",
};

export const STATUS_RANK: Record<TourStatus, number> = {
  top_pick: 0,
  scheduled: 1,
  called: 2,
  toured: 3,
  not_toured: 4,
  rejected: 5,
};

export const STATUS_CYCLE: TourStatus[] = [
  "not_toured",
  "called",
  "scheduled",
  "toured",
  "top_pick",
  "rejected",
];

export const STATUSES: TourStatus[] = [
  "not_toured",
  "called",
  "scheduled",
  "toured",
  "rejected",
  "top_pick",
];
