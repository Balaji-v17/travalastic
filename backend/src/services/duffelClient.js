import 'dotenv/config';
import { Duffel } from '@duffel/api';

/**
 * Configured Duffel client instance using process.env.DUFFEL_API_KEY (test mode key).
 */
export const duffel = new Duffel({
  token: process.env.DUFFEL_API_KEY || '',
});

export default duffel;

