import apiClient from '../config/apiClient';

/**
 * Normalizes HTTP fetch responses into data or normalized error objects:
 * { status: number, code: string, message: string }
 */
async function parseResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-json response body
  }

  if (res.ok) {
    return body;
  }

  const status = res.status;
  const rawError = body?.error;
  const rawMsg = body?.message;

  let code = 'error';
  if (typeof rawError === 'string') {
    if (['proposal_changed', 'itinerary_changed', 'newer_changes_exist', 'too_old'].includes(rawError)) {
      code = rawError;
    } else if (status === 429) {
      code = 'rate_limit';
    } else if (status === 404) {
      code = 'not_found';
    } else if (status === 502) {
      code = '502';
    } else {
      code = body?.code || (status === 429 ? 'rate_limit' : 'error');
    }
  } else if (body?.code) {
    code = String(body.code);
  } else if (status === 429) {
    code = 'rate_limit';
  } else if (status === 404) {
    code = 'not_found';
  } else if (status === 502) {
    code = '502';
  }

  let message =
    (typeof rawMsg === 'string' && rawMsg.trim()) ||
    (typeof rawError === 'string' && rawError.trim()) ||
    rawError?.message ||
    `Request failed with status ${status}`;

  if (status === 429 && (!message || message.includes('status 429'))) {
    message = 'Too many requests, try again in a bit';
  }

  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.message = message;
  throw err;
}

function wrapNetworkError(e) {
  if (e && typeof e.status === 'number' && e.code) {
    throw e;
  }
  const err = new Error(e?.message || 'Network error');
  err.status = 0;
  err.code = 'network_error';
  err.message = e?.message || 'Network error';
  throw err;
}

/**
 * List the user's disruptions, newest first.
 * @returns {Promise<Array<Object>>}
 */
export async function listDisruptions() {
  try {
    const res = await apiClient.get('/disruptions');
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Get full disruption record by ID (including proposal).
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function getDisruption(id) {
  try {
    const res = await apiClient.get(`/disruptions/${id}`);
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Generate a proposal for a disruption.
 * @param {string} id
 * @param {Object} [options]
 * @param {boolean} [options.regenerate]
 * @returns {Promise<Object>}
 */
export async function generateProposal(id, { regenerate = false } = {}) {
  try {
    const query = regenerate ? '?regenerate=true' : '';
    const res = await apiClient.post(`/disruptions/${id}/proposal${query}`, {
      regenerate: Boolean(regenerate),
    });
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Approve a stored disruption proposal.
 * @param {string} id
 * @param {string} baseHash
 * @returns {Promise<Object>}
 */
export async function approveDisruption(id, baseHash) {
  try {
    const res = await apiClient.post(`/disruptions/${id}/approve`, {
      baseHash,
    });
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Dismiss a stored disruption proposal.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function dismissDisruption(id) {
  try {
    const res = await apiClient.post(`/disruptions/${id}/dismiss`, {});
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Undo an approved disruption proposal.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function undoDisruption(id) {
  try {
    const res = await apiClient.post(`/disruptions/${id}/undo`, {});
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Simulate a flight delay disruption for demo purposes.
 * Returns HTTP 404 if disabled on the server.
 *
 * @param {Object} params
 * @param {string} params.itineraryId
 * @param {number} params.dayNumber
 * @param {number} params.delayMinutes
 * @returns {Promise<Object>}
 */
export async function simulateDisruption({ itineraryId, dayNumber, delayMinutes }) {
  try {
    const res = await apiClient.post('/disruptions/simulate', {
      itineraryId,
      dayNumber,
      delayMinutes,
    });
    return await parseResponse(res);
  } catch (err) {
    wrapNetworkError(err);
  }
}

export default {
  listDisruptions,
  getDisruption,
  generateProposal,
  approveDisruption,
  dismissDisruption,
  undoDisruption,
  simulateDisruption,
};

