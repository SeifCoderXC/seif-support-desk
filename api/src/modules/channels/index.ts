export type Channel = {
  id: string;
  label: string;
};

export const liveChat = {
  id: "live-chat",
  label: "Live chat",
} as const satisfies Channel;

export const channels: Channel[] = [liveChat];

export function findChannel(id: string): Channel | null {
  return channels.find((channel) => channel.id === id) ?? null;
}
