/**
 * Pure helpers for handling duplicate itinerary checks and constructing mobile alerts.
 */

/**
 * Builds the payload for POST /itinerary/generate, attaching onDuplicate and replaceTripId
 * only when valid duplicate-handling options are specified.
 *
 * @param {Object} params
 * @param {string} params.rawRequest
 * @param {'replace'|'keep_both'} [params.onDuplicate]
 * @param {string} [params.replaceTripId]
 * @returns {{ rawRequest: string, onDuplicate?: string, replaceTripId?: string }}
 */
export function buildGeneratePayload({ rawRequest, onDuplicate, replaceTripId }) {
  const payload = { rawRequest };
  if (onDuplicate === 'replace' || onDuplicate === 'keep_both') {
    payload.onDuplicate = onDuplicate;
  }
  if (replaceTripId) {
    payload.replaceTripId = replaceTripId;
  }
  return payload;
}

/**
 * Builds the title, message, and button descriptors for React Native Alert.alert.
 *
 * @param {Object} params
 * @param {Object} [params.data] - 409 response payload { duplicate: true, existingTripId, destination, startDate, endDate }
 * @param {string} [params.destination] - Destination from form
 * @param {string} [params.startDate] - Start date from form
 * @param {string} [params.endDate] - End date from form
 * @param {Function} params.onOpenExisting - Callback receiving existingTripId
 * @param {Function} params.onReplace - Callback receiving existingTripId
 * @param {Function} params.onKeepBoth - Callback with no arguments
 * @param {Function} [params.onCancel] - Optional cancel callback
 * @returns {{ title: string, message: string, buttons: Array<{ text: string, style?: string, onPress?: Function }> }}
 */
export function buildDuplicateAlertConfig({
  data,
  destination,
  startDate,
  endDate,
  onOpenExisting,
  onReplace,
  onKeepBoth,
  onCancel,
}) {
  const dest = data?.destination || destination || 'this destination';
  const start = data?.startDate || startDate || '';
  const end = data?.endDate || endDate || '';
  const tripId = data?.existingTripId;

  const dateText = start && end ? ` for ${start} to ${end}` : '';

  return {
    title: 'Existing Trip Found',
    message: `You already have a trip to ${dest}${dateText}.\n\nWould you like to open it, replace it with a new plan, or keep both?`,
    buttons: [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: onCancel || (() => {}),
      },
      {
        text: 'Open Existing',
        onPress: () => {
          if (onOpenExisting && tripId) {
            onOpenExisting(tripId);
          }
        },
      },
      {
        text: 'Replace with New Plan',
        onPress: () => {
          if (onReplace) {
            onReplace(tripId);
          }
        },
      },
      {
        text: 'Keep Both',
        onPress: () => {
          if (onKeepBoth) {
            onKeepBoth();
          }
        },
      },
    ],
  };
}

