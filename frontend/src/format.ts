export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const labels: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  resolved: "Solved",
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function labelOf(value: string): string {
  return labels[value] ?? value.replaceAll("-", " ");
}
