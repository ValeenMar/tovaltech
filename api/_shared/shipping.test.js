import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { calculateShipping, FREE_SHIPPING_THRESHOLD } = require('./shipping');

describe('server shipping calculator', () => {
  it('returns cannot_ship for restricted categories', () => {
    const result = calculateShipping([
      { name: 'Servidor Rack', category: 'SERVIDORES', quantity: 1, unit_price: 1000000 },
    ], 'CABA');

    expect(result.canShip).toBe(false);
    expect(result.tier).toBe('noship');
  });

  it('applies free shipping for medium/small tiers over threshold', () => {
    const result = calculateShipping([
      { name: 'GPU', category: 'PLACA DE VIDEO', quantity: 1, unit_price: FREE_SHIPPING_THRESHOLD + 1000 },
    ], 'GBA');

    expect(result.canShip).toBe(true);
    expect(result.free).toBe(true);
    expect(result.cost).toBe(0);
  });

  it('charges shipping for large tiers', () => {
    const result = calculateShipping([
      { name: 'Monitor', category: 'MONITOR', quantity: 1, unit_price: 40000 },
    ], 'interior');

    expect(result.canShip).toBe(true);
    expect(result.free).toBe(false);
    expect(result.cost).toBe(18990);
  });
});
