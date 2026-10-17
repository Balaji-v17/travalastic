import express from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  getSupportedCurrencies,
  getInrRate,
  FxProviderUnavailableError,
} from '../services/fxRates.js';

const router = express.Router();

/**
 * GET /fx/currencies
 * Auth-protected.
 * Returns { auto: [codes] }
 */
router.get('/currencies', authenticate, async (req, res, next) => {
  try {
    const auto = await getSupportedCurrencies();
    return res.status(200).json({ auto });
  } catch (err) {
    if (err instanceof FxProviderUnavailableError || err?.isFxUnavailable) {
      return res.status(503).json({ unavailable: true });
    }
    next(err);
  }
});

/**
 * GET /fx/rate?currency=XXX
 * Auth-protected.
 * Currency code must match /^[A-Z]{3}$/ (400 otherwise).
 * Returns { currency, inrPerUnit, rateDate, source }
 * or 404 { supported: false } for unsupported codes,
 * or 503 { unavailable: true } when provider is down.
 */
router.get('/rate', authenticate, async (req, res, next) => {
  try {
    const { currency } = req.query;

    if (!currency || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({
        error: 'currency query parameter must match /^[A-Z]{3}$/',
      });
    }

    const rateResult = await getInrRate(currency);
    if (!rateResult) {
      return res.status(404).json({ supported: false });
    }

    return res.status(200).json({
      currency,
      inrPerUnit: rateResult.inrPerUnit,
      rateDate: rateResult.rateDate,
      source: rateResult.source,
    });
  } catch (err) {
    if (err instanceof FxProviderUnavailableError || err?.isFxUnavailable) {
      return res.status(503).json({ unavailable: true });
    }
    next(err);
  }
});

export default router;

