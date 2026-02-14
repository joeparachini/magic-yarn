export const DELIVERY_STATUS_DEFINITIONS = [
  { id: 1, label: "Awaiting confirmation" },
  { id: 2, label: "Approved" },
  { id: 3, label: "Completed" },
  { id: 4, label: "Cancelled" },
] as const;

export type DeliveryStatusId =
  (typeof DELIVERY_STATUS_DEFINITIONS)[number]["id"];

export const DELIVERY_STATUS_IDS = DELIVERY_STATUS_DEFINITIONS.map((s) => s.id);

export const DELIVERY_STATUS_LABELS_BY_ID: Record<DeliveryStatusId, string> = {
  1: "Awaiting confirmation",
  2: "Approved",
  3: "Completed",
  4: "Cancelled",
};

export const DELIVERY_STATUS_OPTIONS = DELIVERY_STATUS_DEFINITIONS.map(
  (status) => ({
    value: status.id,
    label: status.label,
  }),
);

export function isDeliveryStatusId(
  value: number | string | null | undefined,
): value is DeliveryStatusId {
  const parsed =
    typeof value === "string"
      ? Number.parseInt(value, 10)
      : typeof value === "number"
        ? value
        : NaN;
  return (
    Number.isInteger(parsed) &&
    DELIVERY_STATUS_IDS.includes(parsed as DeliveryStatusId)
  );
}

export function toDeliveryStatusId(
  value: number | string | null | undefined,
): DeliveryStatusId | null {
  if (!isDeliveryStatusId(value)) return null;
  return (
    typeof value === "string" ? Number.parseInt(value, 10) : value
  ) as DeliveryStatusId;
}

export function formatDeliveryStatusById(
  value: number | string | null | undefined,
): string {
  const statusId = toDeliveryStatusId(value);
  if (!statusId) return "—";
  return DELIVERY_STATUS_LABELS_BY_ID[statusId];
}
