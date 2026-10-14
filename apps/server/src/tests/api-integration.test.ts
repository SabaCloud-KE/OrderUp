import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// ── Mock Prisma so no real DB calls are made in test ─────────────────────────
vi.mock('../config/prisma', () => ({
  prisma: {
    order: {
      findFirst: vi.fn().mockResolvedValue({
        uuid: 'b0000000-0000-0000-0000-000000000001',
        total: 1450,
        status: 'PENDING',
        clubId: 1,
        tableNumber: 2,
        items: [],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      create: vi.fn().mockResolvedValue({
        uuid: 'pay-uuid',
        method: 'CASH',
        amount: 1450,
        changeDue: 550,
      }),
    },
    notification: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { createApp } from '../app';

describe('Express API Integration Tests', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /health - should return 200 OK and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/v1/auth/login - should validate email and password schema', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'invalid-email',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/payments/cash - should process cash payment and return change calculation', async () => {
    const res = await request(app).post('/api/v1/payments/cash').send({
      clubUuid: 'a0000000-0000-0000-0000-000000000001',
      orderUuid: 'b0000000-0000-0000-0000-000000000001',
      amount: 1450,
      tableNumber: 2,
      exactCash: false,
      customerCashAmount: 2000,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.changeDue).toBe(550);
  });
});
