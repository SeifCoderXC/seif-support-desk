import type { ProductModule } from "../types";
import { samples } from "./samples";
import { scenarios } from "./scenarios";

export const nordvpn: ProductModule = {
  id: "nordvpn",
  label: "NordVPN",
  scenarios,
  samples,
};
