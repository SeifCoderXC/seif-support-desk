import { nordvpn } from "./nordvpn";
import type { ProductModule, Scenario } from "./types";

export const products: ProductModule[] = [nordvpn];

export function findProduct(id: string): ProductModule | null {
  return products.find((product) => product.id === id) ?? null;
}

export function findScenario(productId: string, scenarioKey: string): Scenario | null {
  const product = findProduct(productId);
  if (!product) return null;
  return product.scenarios.find((scenario) => scenario.key === scenarioKey) ?? null;
}
