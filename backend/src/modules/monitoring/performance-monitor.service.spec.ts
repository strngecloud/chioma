import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceMonitorService, PerformanceMetrics } from './performance-monitor.service';
import { MetricsService } from './metrics.service';
import { AlertService } from './alert.service';

const mockMetrics = {
  recordHttpRequest: jest.fn(),
  recordHttpDuration: jest.fn(),
};
const mockAlert = { handleAlert: jest.fn() };

function makeMetric(
  method: string,
  endpoint: string,
  responseTime: number,
  statusCode = 200,
): PerformanceMetrics {
  return {
    timestamp: new Date(),
    endpoint,
    method,
    responseTime,
    statusCode,
    memoryUsage: process.memoryUsage(),
  };
}

describe('PerformanceMonitorService — new methods', () => {
  let service: PerformanceMonitorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitorService,
        { provide: MetricsService, useValue: mockMetrics },
        { provide: AlertService, useValue: mockAlert },
      ],
    }).compile();

    service = module.get(PerformanceMonitorService);
  });

  // ── getResponseTimeStats ─────────────────────────────────────────────────

  describe('getResponseTimeStats', () => {
    beforeEach(() => {
      service.recordRequestMetrics(makeMetric('GET', '/api/properties/:id', 80));
      service.recordRequestMetrics(makeMetric('GET', '/api/properties/:id', 1200)); // slow
      service.recordRequestMetrics(makeMetric('POST', '/api/payments', 300));
    });

    it('returns generated_at, windowSeconds, and routes array', () => {
      const result = service.getResponseTimeStats(60);
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('windowSeconds', 60);
      expect(Array.isArray(result.routes)).toBe(true);
    });

    it('each route entry has required fields', () => {
      const { routes } = service.getResponseTimeStats(60);
      expect(routes.length).toBeGreaterThan(0);
      const r = routes[0];
      expect(r).toHaveProperty('route');
      expect(r).toHaveProperty('count');
      expect(r).toHaveProperty('rps');
      expect(r).toHaveProperty('p50Ms');
      expect(r).toHaveProperty('p95Ms');
      expect(r).toHaveProperty('p99Ms');
      expect(r).toHaveProperty('slowCount');
    });

    it('counts slow requests correctly', () => {
      const { routes } = service.getResponseTimeStats(60);
      const prop = routes.find((r) => r.route === 'GET /api/properties/:id');
      expect(prop).toBeDefined();
      expect(prop!.slowCount).toBe(1);
    });

    it('excludes data outside the window', () => {
      // window of 0 seconds — nothing should qualify
      const { routes } = service.getResponseTimeStats(0);
      expect(routes).toHaveLength(0);
    });

    it('sorts routes by p95Ms descending', () => {
      const { routes } = service.getResponseTimeStats(60);
      for (let i = 1; i < routes.length; i++) {
        expect(routes[i - 1].p95Ms).toBeGreaterThanOrEqual(routes[i].p95Ms);
      }
    });
  });

  // ── getEndpointStats — key parsing ──────────────────────────────────────
    it('correctly parses keys with colons in the path (parameterised routes)', () => {
      // Record under a path that contains a colon
      service.recordRequestMetrics(makeMetric('GET', '/api/properties/:id', 120));
      const stats = service.getEndpointStats('GET', '/api/properties/:id');
      expect(stats).not.toBeNull();
      expect(stats.endpoint).toBe('/api/properties/:id');
      expect(stats.method).toBe('GET');
    });

    it('returns null for an endpoint with no data', () => {
      expect(service.getEndpointStats('GET', '/api/unknown')).toBeNull();
    });
  });

  // ── getSlowEndpoints ─────────────────────────────────────────────────────

  describe('getSlowEndpoints', () => {
    beforeEach(() => {
      service.recordRequestMetrics(makeMetric('GET', '/api/fast', 50));
      service.recordRequestMetrics(makeMetric('GET', '/api/medium', 300));
      service.recordRequestMetrics(makeMetric('GET', '/api/slow', 800));
      service.recordRequestMetrics(makeMetric('POST', '/api/slow', 1200));
    });

    it('returns endpoints sorted by avgResponseTime descending', () => {
      const results = service.getSlowEndpoints(10);
      expect(results.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].avgResponseTime).toBeGreaterThanOrEqual(
          results[i].avgResponseTime,
        );
      }
    });

    it('respects the limit parameter', () => {
      const results = service.getSlowEndpoints(2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('filters by threshold', () => {
      const results = service.getSlowEndpoints(10, 500);
      expect(results.every((r) => r.avgResponseTime >= 500)).toBe(true);
    });

    it('returns empty array when no data matches threshold', () => {
      const results = service.getSlowEndpoints(10, 9999);
      expect(results).toHaveLength(0);
    });
  });

  // ── getEndpointPercentiles ───────────────────────────────────────────────

  describe('getEndpointPercentiles', () => {
    beforeEach(() => {
      // Record 10 requests with known response times
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach((rt) =>
        service.recordRequestMetrics(makeMetric('GET', '/api/test', rt)),
      );
    });

    it('returns null for unknown endpoint', () => {
      expect(service.getEndpointPercentiles('GET', '/api/missing')).toBeNull();
    });

    it('returns p50, p75, p90, p95, p99', () => {
      const p = service.getEndpointPercentiles('GET', '/api/test');
      expect(p).not.toBeNull();
      expect(p).toHaveProperty('p50');
      expect(p).toHaveProperty('p75');
      expect(p).toHaveProperty('p90');
      expect(p).toHaveProperty('p95');
      expect(p).toHaveProperty('p99');
    });

    it('percentiles are in ascending order', () => {
      const p = service.getEndpointPercentiles('GET', '/api/test')!;
      expect(p.p50).toBeLessThanOrEqual(p.p75);
      expect(p.p75).toBeLessThanOrEqual(p.p90);
      expect(p.p90).toBeLessThanOrEqual(p.p95);
      expect(p.p95).toBeLessThanOrEqual(p.p99);
    });
  });

  // ── getAllEndpointPercentiles ─────────────────────────────────────────────

  describe('getAllEndpointPercentiles', () => {
    it('returns an entry per tracked endpoint', () => {
      service.recordRequestMetrics(makeMetric('GET', '/api/a', 100));
      service.recordRequestMetrics(makeMetric('POST', '/api/b', 200));
      const all = service.getAllEndpointPercentiles();
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all[0]).toHaveProperty('method');
      expect(all[0]).toHaveProperty('endpoint');
      expect(all[0]).toHaveProperty('p95');
    });

    it('returns results sorted by p95 descending', () => {
      service.recordRequestMetrics(makeMetric('GET', '/api/fast', 10));
      service.recordRequestMetrics(makeMetric('GET', '/api/slow', 900));
      const all = service.getAllEndpointPercentiles();
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].p95).toBeGreaterThanOrEqual(all[i].p95);
      }
    });

    it('returns empty array when no data recorded', () => {
      expect(service.getAllEndpointPercentiles()).toHaveLength(0);
    });
  });
});
