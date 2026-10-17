/**
 * Pure function to build a compact, whitelisted plain-text context of a trip.
 *
 * Rules:
 * - Only whitelisted fields go in; unknown fields are never copied.
 * - Sensitive flight data (passenger names, dates of birth, booking references, payment data)
 *   are STRICTLY excluded.
 * - Estimates and actuals are labelled differently.
 * - Missing data produces the explicit "NOT AVAILABLE" list.
 *
 * @param {Object} [itinerary={}] - Itinerary document or object
 * @param {Array|Object} [expenseSummary=[]] - Array of Expense documents or summary object
 * @param {Array} [flightSummaries=[]] - Array of Booking documents or flight summary objects
 * @returns {string} Compact plain-text trip context
 */
export function buildTripContext(itinerary = {}, expenseSummary = [], flightSummaries = []) {
  const itin =
    itinerary && typeof itinerary.toObject === 'function'
      ? itinerary.toObject()
      : itinerary || {};

  const lines = [];

  // --- 1. TRIP OVERVIEW (Whitelisted fields only) ---
  lines.push('=== TRIP OVERVIEW ===');
  lines.push(`Destination: ${itin.destination || 'Not specified'}`);

  let datesText = 'Not specified';
  if (itin.startDate && itin.endDate) {
    datesText = `${itin.startDate} to ${itin.endDate}`;
  } else if (itin.startDate) {
    datesText = `From ${itin.startDate}`;
  } else if (itin.endDate) {
    datesText = `Until ${itin.endDate}`;
  }
  lines.push(`Dates: ${datesText}`);
  lines.push(`Budget Tier: ${itin.budgetTier || 'Not specified'}`);

  const interestsText =
    Array.isArray(itin.interests) && itin.interests.length > 0
      ? itin.interests.filter(Boolean).join(', ')
      : 'None specified';
  lines.push(`Interests: ${interestsText}`);

  // Total estimated cost (AI estimate)
  const totalEstimate = itin.budgetEstimate != null ? `₹${itin.budgetEstimate}` : 'Not specified';
  lines.push(`Total Estimated Cost: ${totalEstimate} (AI estimate)`);

  // --- 2. DAILY ITINERARY ---
  lines.push('\n=== DAILY SCHEDULE ===');
  const days = Array.isArray(itin.days) ? itin.days : [];

  if (days.length === 0) {
    lines.push('No days planned yet.');
  } else {
    for (const day of days) {
      if (!day) continue;
      const dayNum = day.dayNumber != null ? day.dayNumber : '?';
      lines.push(`\n--- Day ${dayNum} ---`);

      const dayEstimate =
        day.estimatedCostINR != null ? `₹${day.estimatedCostINR}` : 'Not specified';
      lines.push(`Day Estimated Cost: ${dayEstimate} (AI estimate)`);
      lines.push(
        `Accommodation Suggestion: ${day.accommodationSuggestion || 'Not specified'}`
      );

      const activities = Array.isArray(day.activities) ? day.activities : [];
      if (activities.length === 0) {
        lines.push('Activities: No activities scheduled');
      } else {
        lines.push('Activities:');
        activities.forEach((act, idx) => {
          if (!act) return;
          const actObj = typeof act.toObject === 'function' ? act.toObject() : act;

          let title = 'Untitled';
          let description = 'None';
          let suggestedTime = 'Not specified';
          let isDone = false;
          let locationKnownText = 'No';

          if (typeof actObj === 'string') {
            title = actObj;
          } else if (typeof actObj === 'object') {
            title = actObj.title || actObj.name || 'Untitled';
            description = actObj.description || 'None';
            suggestedTime = actObj.suggestedTime || 'Not specified';
            isDone = Boolean(actObj.done);

            const loc = actObj.location;
            const hasCoords =
              loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
            const hasPlaceName = Boolean(loc && loc.placeName);

            if (hasCoords && hasPlaceName) {
              locationKnownText = `Yes (${loc.placeName}, lat: ${loc.lat}, lon: ${loc.lon})`;
            } else if (hasCoords) {
              locationKnownText = `Yes (lat: ${loc.lat}, lon: ${loc.lon})`;
            } else if (hasPlaceName) {
              locationKnownText = `Yes (${loc.placeName})`;
            }
          }

          const doneFlag = isDone ? '[Done]' : '[Not done]';
          lines.push(
            `  ${idx + 1}. ${title} ${doneFlag}`
          );
          lines.push(`     Time: ${suggestedTime}`);
          lines.push(`     Description: ${description}`);
          lines.push(`     Location known: ${locationKnownText}`);
        });
      }
    }
  }

  // --- 3. LOGGED EXPENSES (actual, logged by the user, not tied to a specific day) ---
  lines.push('\n=== LOGGED EXPENSES ===');
  lines.push('(actual, logged by the user, not tied to a specific day)');

  let totalSpent = 0;
  const categoryTotals = {};

  if (Array.isArray(expenseSummary)) {
    for (const exp of expenseSummary) {
      if (!exp) continue;
      const amt = Number(exp.amountINR) || 0;
      totalSpent += amt;
      const cat = exp.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  } else if (expenseSummary && typeof expenseSummary === 'object') {
    totalSpent = Number(
      expenseSummary.totalSpent ??
        expenseSummary.total ??
        expenseSummary.totalAmountINR ??
        0
    );
    const cats = expenseSummary.byCategory || expenseSummary.totals || {};
    for (const [k, v] of Object.entries(cats)) {
      categoryTotals[k] = Number(v) || 0;
    }
  }

  lines.push(`Total Logged: ₹${totalSpent} (actual, logged by the user, not tied to a specific day)`);
  const catEntries = Object.entries(categoryTotals);
  if (catEntries.length > 0) {
    lines.push('Totals by Category:');
    for (const [cat, amt] of catEntries) {
      lines.push(`  • ${cat}: ₹${amt}`);
    }
  } else {
    lines.push('Totals by Category: None logged');
  }

  // --- 4. LINKED FLIGHT BOOKINGS (Whitelisted: route, departure date/time, status ONLY) ---
  // NEVER include passenger names, dates of birth, booking references, or payment data.
  lines.push('\n=== LINKED FLIGHT BOOKINGS ===');
  const flights = Array.isArray(flightSummaries) ? flightSummaries : [];

  if (flights.length === 0) {
    lines.push('No linked flight bookings.');
  } else {
    for (const flight of flights) {
      if (!flight) continue;
      const f = typeof flight.toObject === 'function' ? flight.toObject() : flight;

      let route = 'Not specified';
      if (f.origin && f.destination) {
        route = `${f.origin} → ${f.destination}`;
      } else if (f.route) {
        route = f.route;
      } else if (f.slices?.[0]?.origin?.iata_code && f.slices?.[0]?.destination?.iata_code) {
        route = `${f.slices[0].origin.iata_code} → ${f.slices[0].destination.iata_code}`;
      }

      let departure = 'Not specified';
      if (f.departureTime) {
        try {
          departure = new Date(f.departureTime).toISOString();
        } catch {
          departure = String(f.departureTime);
        }
      } else if (f.departureDate) {
        departure = String(f.departureDate);
      }

      const status = f.status || 'confirmed';

      // Strictly route, departure date/time, status ONLY
      lines.push(`• Route: ${route} | Departure: ${departure} | Status: ${status}`);
    }
  }

  // --- 5. EXPLICIT NOT AVAILABLE LIST ---
  lines.push('\n=== NOT AVAILABLE IN TRIP DATA ===');
  lines.push('(Do not invent, assume, or fabricate any of the following)');
  lines.push('- Number of travelers');
  lines.push('- Opening hours');
  lines.push('- Travel times between places');
  lines.push('- Ticket prices');
  lines.push('- Hotel confirmations');
  lines.push('- Train/bus/cab bookings');

  return lines.join('\n');
}

export default buildTripContext;

