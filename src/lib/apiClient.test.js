import { describe, it, expect } from 'vitest';
import { buildQuery } from './apiClient';

describe('apiClient helpers', () => {
  it('builds query string ignoring empty values', () => {
    const query = buildQuery({
      categoria: 'PLACA DE VIDEO',
      buscar: '',
      offset: 0,
      limit: 24,
      marca: null,
    });

    expect(query).toContain('categoria=PLACA+DE+VIDEO');
    expect(query).toContain('offset=0');
    expect(query).toContain('limit=24');
    expect(query).not.toContain('buscar=');
    expect(query).not.toContain('marca=');
  });
});
