import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

import { normalizeSearchKey, escapeRegex, levenshtein } from '../src/utils/cityNormalizer.js';
import {
  parseCitiesCsv,
  validateAndTransformCityRow,
  buildRegionsFromCities,
  seedCities,
} from '../scripts/seedCities.js';
import destinationsRouter from '../src/routes/destinations.js';
import City from '../src/models/City.js';
import Region from '../src/models/Region.js';
import TouristPlace from '../src/models/TouristPlace.js';

function dispatch(app, { method, url }) {
  return new Promise((resolve) => {
    const req = Readable.from([]);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {};
    req.ip = '127.0.0.1';
    req.socket = { remoteAddress: '127.0.0.1' };

    let statusCode = 200;
    const resHeaders = {};
    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(resHeaders);
    res.hasHeader = (k) => Boolean(resHeaders[k.toLowerCase()]);
    res.removeHeader = (k) => { delete resHeaders[k.toLowerCase()]; };
    res.set = (k, v) => { resHeaders[String(k).toLowerCase()] = v; };
    res.status = (code) => { statusCode = code; return res; };
    res.json = (data) => {
      resolve({ status: statusCode, body: data, headers: resHeaders });
      res.emit('finish');
      return res;
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' }, headers: resHeaders });
    });
  });
}

describe('City searchKey normalizer', () => {
  it('folds NFD accents and non-NFD characters (ł, ø, đ, ß, æ, œ, ı, þ) to ASCII lowercase', () => {
    assert.equal(normalizeSearchKey('Łódź'), 'lodz');
    assert.equal(normalizeSearchKey('Kraków'), 'krakow');
    assert.equal(normalizeSearchKey('København'), 'kobenhavn');
    assert.equal(normalizeSearchKey('Đà Nẵng'), 'da nang');
    assert.equal(normalizeSearchKey('Mahārāshtra'), 'maharashtra');
    assert.equal(normalizeSearchKey('Tōkyō'), 'tokyo');
    assert.equal(normalizeSearchKey('São Paulo'), 'sao paulo');
    assert.equal(normalizeSearchKey('Sao Paulo'), 'sao paulo');
    assert.equal(normalizeSearchKey('Straße'), 'strasse');
    assert.equal(normalizeSearchKey('Bærum'), 'baerum');
    assert.equal(normalizeSearchKey('Cœur'), 'coeur');
    assert.equal(normalizeSearchKey('Diyarbakır'), 'diyarbakir');
    assert.equal(normalizeSearchKey('Þórshöfn'), 'thorshofn');
  });
});

describe('CSV parser and row validation', () => {
  it('handles quoted fields, commas inside names, diacritics, and empty population', () => {
    const csv = [
      'city,city_ascii,lat,lng,country,iso2,iso3,admin_name,capital,population,id',
      '"San José, South",San Jose South,9.9281,-84.0907,Costa Rica,CR,CRI,"San José",primary,,1188000001',
      '"São Paulo",Sao Paulo,-23.5504,-46.6339,Brazil,BR,BRA,"São Paulo",admin,23086000,1076532519',
    ].join('\n');

    const rows = parseCitiesCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].city, 'San José, South');
    assert.equal(rows[0].population, '');

    const first = validateAndTransformCityRow(rows[0]);
    assert.equal(first.valid, true);
    assert.equal(first.city.name, 'San José, South');
    assert.equal(first.city.searchKey, 'san jose, south');
    assert.equal(first.city.population, null);

    const second = validateAndTransformCityRow(rows[1]);
    assert.equal(second.valid, true);
    assert.equal(second.city.searchKey, 'sao paulo');
    assert.equal(second.city.population, 23086000);
  });

  it('skips rows with invalid lat/lng or missing required fields', () => {
    const badLat = validateAndTransformCityRow({
      city: 'BadLat', lat: '95', lng: '10', country: 'Test', id: '1',
    });
    assert.equal(badLat.valid, false);

    const badLng = validateAndTransformCityRow({
      city: 'BadLng', lat: '10', lng: '-185', country: 'Test', id: '2',
    });
    assert.equal(badLng.valid, false);

    const nanCoord = validateAndTransformCityRow({
      city: 'NaNCoord', lat: 'abc', lng: '10', country: 'Test', id: '3',
    });
    assert.equal(nanCoord.valid, false);

    const missingId = validateAndTransformCityRow({
      city: 'NoId', lat: '10', lng: '10', country: 'Test', id: '',
    });
    assert.equal(missingId.valid, false);
  });

  it('builds distinct Regions with rounded average coordinates', () => {
    const regions = buildRegionsFromCities([
      { name: 'Panaji', admin: 'Goa', country: 'India', iso2: 'IN', lat: 15.49, lng: 73.82 },
      { name: 'Margao', admin: 'Goa', country: 'India', iso2: 'IN', lat: 15.27, lng: 73.96 },
      { name: 'Mumbai', admin: 'Mahārāshtra', country: 'India', iso2: 'IN', lat: 19.0758, lng: 72.8775 },
    ]);
    assert.equal(regions.length, 2);
    const goa = regions.find((r) => r.searchKey === 'goa');
    assert.ok(goa);
    assert.equal(goa.lat, 15.38);
    assert.equal(goa.lng, 73.89);
    const mah = regions.find((r) => r.searchKey === 'maharashtra');
    assert.ok(mah);
    assert.equal(mah.name, 'Mahārāshtra');
  });
});

describe('Seed script idempotency', () => {
  it('upserts idempotently across two runs, skips invalid rows, and calls syncIndexes()', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-cities-test-'));
    const csvPath = path.join(tmpDir, 'cities.csv');
    fs.writeFileSync(
      csvPath,
      [
        'city,city_ascii,lat,lng,country,iso2,iso3,admin_name,capital,population,id',
        'Mumbai,Mumbai,19.0758,72.8775,India,IN,IND,Mahārāshtra,admin,24973000,1356226629',
        'BadCity,BadCity,999,10,Nowhere,XX,XXX,Bad,primary,100,9999999999',
        'Kraków,Krakow,50.0614,19.9372,Poland,PL,POL,Małopolskie,admin,780000,1616172264',
      ].join('\n'),
      'utf8'
    );

    const makeMockModel = (keyField, collectionName) => {
      const store = new Map();
      let syncIndexesCalls = 0;
      return {
        collection: { name: collectionName },
        get syncIndexesCalls() { return syncIndexesCalls; },
        get store() { return store; },
        async bulkWrite(ops) {
          let upsertedCount = 0;
          let modifiedCount = 0;
          let matchedCount = 0;
          for (const op of ops) {
            const key = op.updateOne.filter[keyField];
            const doc = op.updateOne.update.$set;
            const prev = store.get(key);
            if (!prev) {
              store.set(key, JSON.stringify(doc));
              upsertedCount++;
            } else {
              matchedCount++;
              const nextJson = JSON.stringify(doc);
              if (prev !== nextJson) {
                store.set(key, nextJson);
                modifiedCount++;
              }
            }
          }
          return { upsertedCount, modifiedCount, matchedCount };
        },
        async syncIndexes() {
          syncIndexesCalls++;
        },
        async countDocuments() {
          return store.size;
        },
      };
    };

    const MockCity = makeMockModel('sourceId', 'cities');
    const MockRegion = makeMockModel('sourceKey', 'regions');
    const quietLogger = { log: () => {}, warn: () => {}, error: () => {} };

    try {
      const run1 = await seedCities({
        csvPath,
        connect: false,
        closeConnection: false,
        CityModel: MockCity,
        RegionModel: MockRegion,
        logger: quietLogger,
      });
      assert.equal(run1.inserted, 2);
      assert.equal(run1.updated, 0);
      assert.equal(run1.skipped, 1);
      assert.equal(MockCity.store.size, 2);
      assert.equal(MockRegion.store.size, 2);
      assert.equal(MockCity.syncIndexesCalls, 1);
      assert.equal(MockRegion.syncIndexesCalls, 1);

      const run2 = await seedCities({
        csvPath,
        connect: false,
        closeConnection: false,
        CityModel: MockCity,
        RegionModel: MockRegion,
        logger: quietLogger,
      });
      assert.equal(run2.inserted, 0);
      assert.equal(run2.updated, 0);
      assert.equal(run2.skipped, 1);
      assert.equal(MockCity.store.size, 2);
      assert.equal(MockRegion.store.size, 2);
      assert.equal(MockCity.syncIndexesCalls, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('GET /destinations/cities & GET /destinations/check', () => {
  let app;
  let origCityFind;
  let origCityFindOne;
  let origRegionFind;
  let origRegionFindOne;
  let origPlaceFindOne;
  let origFetch;
  let fetchCalls;
  let mockCities;
  let mockRegions;
  let mockPlaces;
  let lastCityFilter;
  let lastCityLimit;

  beforeEach(() => {
    fetchCalls = 0;
    lastCityFilter = null;
    lastCityLimit = null;

    mockCities = [
      { sourceId: '1', name: 'Mumbai', searchKey: 'mumbai', admin: 'Mahārāshtra', country: 'India', iso2: 'IN', lat: 19.0758, lng: 72.8775, population: 24973000 },
      { sourceId: '2', name: 'Mumbwa', searchKey: 'mumbwa', admin: 'Central', country: 'Zambia', iso2: 'ZM', lat: -14.98, lng: 27.06, population: null },
      { sourceId: '3', name: 'Mumford', searchKey: 'mumford', admin: 'Central', country: 'Ghana', iso2: 'GH', lat: 5.26, lng: -0.76, population: 18368 },
      { sourceId: '4', name: 'São Paulo', searchKey: 'sao paulo', admin: 'São Paulo', country: 'Brazil', iso2: 'BR', lat: -23.5504, lng: -46.6339, population: 23086000 },
      { sourceId: '5', name: 'Łódź', searchKey: 'lodz', admin: 'Łódzkie', country: 'Poland', iso2: 'PL', lat: 51.7592, lng: 19.456, population: 670642 },
      { sourceId: '6', name: 'København', searchKey: 'kobenhavn', admin: 'Hovedstaden', country: 'Denmark', iso2: 'DK', lat: 55.6761, lng: 12.5683, population: 1366301 },
    ];
    mockRegions = [
      { sourceKey: 'goa::india', name: 'Goa', searchKey: 'goa', country: 'India', iso2: 'IN', lat: 15.38, lng: 73.89 },
      { sourceKey: 'maharashtra::india', name: 'Mahārāshtra', searchKey: 'maharashtra', country: 'India', iso2: 'IN', lat: 19.1, lng: 74.5 },
      { sourceKey: 'sao paulo::brazil', name: 'São Paulo', searchKey: 'sao paulo', country: 'Brazil', iso2: 'BR', lat: -23.5, lng: -46.6 },
    ];
    mockPlaces = [
      { _id: 'tp1', name: 'Varkala Cliff', city: 'Varkala', hidden: false },
    ];

    app = express();
    app.use('/destinations', destinationsRouter);

    origCityFind = City.find;
    origCityFindOne = City.findOne;
    origRegionFind = Region.find;
    origRegionFindOne = Region.findOne;
    origPlaceFindOne = TouristPlace.findOne;
    origFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      fetchCalls++;
      throw new Error('External HTTP call forbidden in city search');
    };

    const makeChain = (rows, recordLimit) => ({
      select: () => makeChain(rows, recordLimit),
      sort: () => makeChain(rows, recordLimit),
      limit: (n) => {
        if (recordLimit) recordLimit(n);
        return {
          lean: async () => rows.slice(0, n),
        };
      },
      lean: async () => rows,
    });

    City.find = (filter = {}) => {
      lastCityFilter = filter;
      const rx = filter.searchKey;
      const matched = rx ? mockCities.filter((c) => rx.test(c.searchKey)) : mockCities;
      return makeChain(matched, (n) => { lastCityLimit = n; });
    };
    City.findOne = (filter = {}) => ({
      select: () => ({
        lean: async () => mockCities.find((c) => filter.searchKey?.test(c.searchKey)) || null,
      }),
    });

    Region.find = (filter = {}) => {
      const rx = filter.searchKey;
      const matched = rx ? mockRegions.filter((r) => rx.test(r.searchKey)) : mockRegions;
      return makeChain(matched);
    };
    Region.findOne = (filter = {}) => ({
      select: () => ({
        lean: async () => mockRegions.find((r) => filter.searchKey?.test(r.searchKey)) || null,
      }),
    });

    TouristPlace.findOne = (filter = {}) => ({
      select: () => ({
        lean: async () => {
          const ors = filter.$or || [];
          return mockPlaces.find((p) =>
            ors.some((cond) =>
              (cond.city && cond.city.test(p.city)) || (cond.name && cond.name.test(p.name))
            )
          ) || null;
        },
      }),
    });
  });

  afterEach(() => {
    City.find = origCityFind;
    City.findOne = origCityFindOne;
    Region.find = origRegionFind;
    Region.findOne = origRegionFindOne;
    TouristPlace.findOne = origPlaceFindOne;
    globalThis.fetch = origFetch;
  });

  it('orders prefix matches by population descending with nulls last and never makes outbound HTTP calls', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=mum' });
    assert.equal(res.status, 200);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(
      res.body.cities.map((c) => c.name),
      ['Mumbai', 'Mumford', 'Mumbwa']
    );
    assert.equal(res.body.cities[0].population, 24973000);
    assert.equal(res.body.cities[2].population, null);
    assert.deepEqual(Object.keys(res.body.cities[0]).sort(), [
      'admin', 'country', 'id', 'iso2', 'lat', 'lng', 'name', 'population', 'type',
    ]);
  });

  it('matches diacritic city and region names from ASCII queries and deduplicates identical city/region text', async () => {
    const sao = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=sao' });
    assert.equal(sao.status, 200);
    assert.equal(sao.body.cities.length, 1); // Region São Paulo, Brazil deduped against City São Paulo, Brazil
    assert.equal(sao.body.cities[0].name, 'São Paulo');

    const lodz = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=lod' });
    assert.equal(lodz.status, 200);
    assert.equal(lodz.body.cities[0].name, 'Łódź');

    const kbh = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=kob' });
    assert.equal(kbh.status, 200);
    assert.equal(kbh.body.cities[0].name, 'København');

    const goa = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=goa' });
    assert.equal(goa.status, 200);
    assert.equal(goa.body.cities.length, 1);
    assert.equal(goa.body.cities[0].type, 'region');
    assert.equal(goa.body.cities[0].name, 'Goa');
  });

  it('enforces min query length of 2 chars and clamps limit to 1..10', async () => {
    const empty = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=' });
    assert.equal(empty.status, 400);

    const short = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=%20m%20' });
    assert.equal(short.status, 400);

    const high = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=mum&limit=500' });
    assert.equal(high.status, 200);
    assert.equal(lastCityLimit, 10);

    const low = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=mum&limit=0' });
    assert.equal(low.status, 200);
    assert.equal(lastCityLimit, 1);
    assert.equal(low.body.cities.length, 1);
  });

  it('safely escapes regex-injection inputs ("a.*", "(")', async () => {
    const res1 = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=a.*' });
    assert.equal(res1.status, 200);
    assert.deepEqual(res1.body.cities, []);
    assert.equal(lastCityFilter.searchKey.source, '^' + escapeRegex('a.*'));

    const res2 = await dispatch(app, { method: 'GET', url: '/destinations/cities?q=((' });
    assert.equal(res2.status, 200);
    assert.deepEqual(res2.body.cities, []);
  });

  it('checkDestinationKnown recognizes City, Region, TouristPlace and suggests closest cities for typos', async () => {
    const cityRes = await dispatch(app, { method: 'GET', url: '/destinations/check?q=Mumbai' });
    assert.equal(cityRes.status, 200);
    assert.equal(cityRes.body.known, true);

    const regionRes = await dispatch(app, { method: 'GET', url: '/destinations/check?q=Goa' });
    assert.equal(regionRes.status, 200);
    assert.equal(regionRes.body.known, true);

    const placeRes = await dispatch(app, { method: 'GET', url: '/destinations/check?q=Varkala' });
    assert.equal(placeRes.status, 200);
    assert.equal(placeRes.body.known, true);

    const typoRes = await dispatch(app, { method: 'GET', url: '/destinations/check?q=Mumbay' });
    assert.equal(typoRes.status, 200);
    assert.equal(typoRes.body.known, false);
    assert.ok(typoRes.body.suggestions.some((s) => s.name === 'Mumbai'));
    assert.ok(typoRes.body.suggestions.length <= 3);
    assert.equal(fetchCalls, 0);
  });

  it('levenshtein helper computes edit distance accurately', () => {
    assert.equal(levenshtein('mumbay', 'mumbai'), 1);
    assert.equal(levenshtein('lodz', 'lodz'), 0);
  });
});

