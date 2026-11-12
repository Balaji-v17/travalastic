import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import AdminUser from '../src/models/AdminUser.js';
import adminRouter from '../src/routes/admin.js';
import { validateAdminConfig } from '../src/middleware/adminAuth.js';

const ADMIN_JWT_SECRET = 'test_admin_hardening_secret_min_32_characters_key';
const TRAVELER_JWT_SECRET = 'test_traveler_jwt_secret_min_32_characters_key';

describe('Admin Panel Piece A10a: Production Hardening, Proxy IP & CORS', () => {
  let inMemoryAdmins;

  before(() => {
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_ORIGINS = 'http://localhost:8444,https://admin.travalastic.com';
    process.env.WEB_ORIGINS = 'http://localhost:8443,https://travalastic.vercel.app';
  });

  beforeEach(() => {
    inMemoryAdmins = new Map();

    AdminUser.findOne = (filter) => {
      let found = null;
      if (filter && filter.email) {
        for (const u of inMemoryAdmins.values()) {
          if (u.email === filter.email) {
            found = u;
            break;
          }
        }
      }
      return {
        lean: () => Promise.resolve(found ? { ...found } : null),
        then: (resolve) => resolve(found ? { ...found } : null),
      };
    };

    AdminUser.findById = (id) => {
      const doc = inMemoryAdmins.get(id?.toString());
      return {
        lean: () => Promise.resolve(doc ? { ...doc } : null),
        then: (resolve) => resolve(doc ? { ...doc } : null),
      };
    };
  });

  function createHardenedApp() {
    const app = express();
    app.set('trust proxy', 1);

    const adminAllowedOrigins = (process.env.ADMIN_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const adminCors = cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (adminAllowedOrigins.length > 0 && adminAllowedOrigins.includes(cleanOrigin) && cleanOrigin !== '*') {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    });

    app.use('/admin', adminCors, adminRouter);
    return app;
  }

  function dispatch(appInstance, { method, url, headers = {}, body = null }) {
    return new Promise((resolve) => {
      const lowerHeaders = {};
      for (const [k, v] of Object.entries(headers)) {
        lowerHeaders[k.toLowerCase()] = v;
      }
      if (!lowerHeaders['content-type']) {
        lowerHeaders['content-type'] = 'application/json';
      }

      const req = {
        method,
        url,
        headers: lowerHeaders,
        body: body || {},
        app: appInstance,
        socket: { remoteAddress: '10.0.0.1' }, // Render reverse proxy internal IP
      };

      // Emulate Express trust proxy resolution
      if (appInstance.get('trust proxy')) {
        const xff = lowerHeaders['x-forwarded-for'];
        if (xff) {
          const ips = xff.split(',').map((ip) => ip.trim());
          req.ip = ips[ips.length - 1]; // Client IP via 1 hop
        } else {
          req.ip = req.socket.remoteAddress;
        }
      } else {
        req.ip = req.socket.remoteAddress;
      }

      const res = {
        statusCode: 200,
        headers: {},
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader(name, val) {
          this.headers[name.toLowerCase()] = val;
        },
        getHeader(name) {
          return this.headers[name.toLowerCase()];
        },
        json(data) {
          resolve({ status: this.statusCode, headers: this.headers, body: data });
        },
        send(data) {
          resolve({ status: this.statusCode, headers: this.headers, body: data });
        },
        on() {},
        emit() {},
      };

      appInstance.handle(req, res);
    });
  }

  it('1. Trust proxy: rate limits separate two clients with different X-Forwarded-For behind same proxy', async () => {
    const app = createHardenedApp();
    const clientA_IP = '203.0.113.195';
    const clientB_IP = '198.51.100.42';

    // Client A sends 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/login',
        headers: { 'X-Forwarded-For': clientA_IP },
        body: { email: 'clienta@travalastic.com', password: 'wrong-password' },
      });
      assert.equal(res.status, 401);
    }

    // 6th attempt from Client A must be rate-limited by IP limiter (HTTP 429)
    const clientA_Blocked = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      headers: { 'X-Forwarded-For': clientA_IP },
      body: { email: 'clienta@travalastic.com', password: 'wrong-password' },
    });
    assert.equal(clientA_Blocked.status, 429);
    assert.match(clientA_Blocked.body.error, /Too many failed login attempts/i);

    // Client B from different IP must NOT be blocked (receives 401, not 429)
    const clientB_Allowed = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      headers: { 'X-Forwarded-For': clientB_IP },
      body: { email: 'clientb@travalastic.com', password: 'wrong-password' },
    });
    assert.equal(clientB_Allowed.status, 401);
    assert.notEqual(clientB_Allowed.status, 429);
  });

  it('2. Admin CORS: rejects traveler web origins on /admin routes, permits only ADMIN_ORIGINS', async () => {
    const app = createHardenedApp();

    // Traveler web origin (e.g. https://travalastic.vercel.app or http://localhost:8443) must be rejected
    const travelerRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      headers: {
        Origin: 'https://travalastic.vercel.app',
      },
      body: { email: 'admin@travalastic.com', password: 'test' },
    });
    assert.equal(travelerRes.headers['access-control-allow-origin'], undefined);

    const travelerPortRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      headers: {
        Origin: 'http://localhost:8443',
      },
      body: { email: 'admin@travalastic.com', password: 'test' },
    });
    assert.equal(travelerPortRes.headers['access-control-allow-origin'], undefined);

    // Explicit ADMIN_ORIGINS (e.g. http://localhost:8444) is allowed
    const adminOriginRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      headers: {
        Origin: 'http://localhost:8444',
      },
      body: { email: 'admin@travalastic.com', password: 'test' },
    });
    assert.equal(adminOriginRes.headers['access-control-allow-origin'], 'http://localhost:8444');
  });

  it('3. Production safety: /admin/ping returns 404 when NODE_ENV=production', async () => {
    const app = createHardenedApp();
    const adminId = new mongoose.Types.ObjectId().toString();
    inMemoryAdmins.set(adminId, {
      _id: new mongoose.Types.ObjectId(adminId),
      email: 'admin@travalastic.com',
      role: 'super_admin',
      active: true,
      mustChangePassword: false,
    });

    const token = jwt.sign(
      { sub: adminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '1h' }
    );

    // In development mode: returns 200 { ok: true, role }
    process.env.NODE_ENV = 'development';
    const devPing = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(devPing.status, 200);
    assert.equal(devPing.body.ok, true);

    // In production mode: returns 404
    process.env.NODE_ENV = 'production';
    const prodPing = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(prodPing.status, 404);

    // Reset NODE_ENV
    delete process.env.NODE_ENV;
  });

  it('4. Refuses admin routes when ADMIN_JWT_SECRET is missing, <32 chars, or equal to traveler secret', () => {
    // Missing
    delete process.env.ADMIN_JWT_SECRET;
    assert.throws(() => validateAdminConfig(), {
      message: 'ADMIN_JWT_SECRET is required but not configured.',
    });

    // < 32 chars
    process.env.ADMIN_JWT_SECRET = 'secret_shorter_than_32_chars';
    assert.throws(() => validateAdminConfig(), {
      message: 'ADMIN_JWT_SECRET must be at least 32 characters long.',
    });

    // Equal to traveler secret
    process.env.ADMIN_JWT_SECRET = process.env.JWT_SECRET;
    assert.throws(() => validateAdminConfig(), {
      message: 'ADMIN_JWT_SECRET must differ from traveler JWT_SECRET.',
    });

    // Valid
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    assert.doesNotThrow(() => validateAdminConfig());
  });
});
