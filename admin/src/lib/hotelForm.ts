/**
 * Form validation helper for Curated Hotel create and edit screens.
 * Mirrors server-side validation rules exactly.
 */

export interface HotelFormValues {
  name: string;
  destination: string;
  budgetTier: string;
  priceRangeINR: string;
  rating: string;
}

export interface HotelValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const HTML_REGEX = /<[^>]*>/;
export const MAX_SANE_PRICE_INR = 1000000;

export function validateHotelForm(values: HotelFormValues): HotelValidationResult {
  const errors: Record<string, string> = {};

  // 1. Hotel name (required, 2-120 chars, no HTML)
  const name = values.name ? values.name.trim() : '';
  if (!name) {
    errors.name = 'Hotel name is required';
  } else if (HTML_REGEX.test(name)) {
    errors.name = 'HTML tags are not allowed in hotel name';
  } else if (name.length < 2) {
    errors.name = 'Hotel name must be at least 2 characters';
  } else if (name.length > 120) {
    errors.name = 'Hotel name cannot exceed 120 characters';
  }

  // 2. Destination / City (required, 2-100 chars, no HTML)
  const destination = values.destination ? values.destination.trim() : '';
  if (!destination) {
    errors.destination = 'Destination is required';
  } else if (HTML_REGEX.test(destination)) {
    errors.destination = 'HTML tags are not allowed in destination';
  } else if (destination.length < 2) {
    errors.destination = 'Destination must be at least 2 characters';
  } else if (destination.length > 100) {
    errors.destination = 'Destination cannot exceed 100 characters';
  }

  // 3. Budget tier (required, budget | mid | luxury)
  const tier = values.budgetTier ? values.budgetTier.trim().toLowerCase() : '';
  if (!tier) {
    errors.budgetTier = 'Budget tier is required';
  } else if (!['budget', 'mid', 'luxury'].includes(tier)) {
    errors.budgetTier = 'Budget tier must be one of: budget, mid, luxury';
  }

  // 4. Rating (optional, number between 0 and 5)
  if (values.rating !== undefined && values.rating !== null && values.rating.trim() !== '') {
    const numRating = Number(values.rating.trim());
    if (isNaN(numRating) || numRating < 0 || numRating > 5) {
      errors.rating = 'Rating must be a number between 0 and 5';
    }
  }

  // 5. Price range (optional, positive numbers <= 1,000,000, no HTML)
  if (values.priceRangeINR !== undefined && values.priceRangeINR !== null && values.priceRangeINR.trim() !== '') {
    const rawPrice = values.priceRangeINR.trim();
    if (HTML_REGEX.test(rawPrice)) {
      errors.priceRangeINR = 'HTML tags are not allowed in price';
    } else if (rawPrice.length > 100) {
      errors.priceRangeINR = 'Price range cannot exceed 100 characters';
    } else {
      if (/-\s*\d/.test(rawPrice) && !/^\s*\d+[\d,]*\s*-\s*\d+/.test(rawPrice) && !/₹\s*\d+[\d,]*\s*-\s*₹?\s*\d+/.test(rawPrice)) {
        errors.priceRangeINR = 'Price must be greater than 0';
      } else {
        const cleaned = rawPrice.replace(/,/g, '');
        const matches = cleaned.match(/\d+(?:\.\d+)?/g);
        if (!matches || matches.length === 0) {
          errors.priceRangeINR = 'Price must contain valid positive numbers';
        } else {
          const nums = matches.map((m) => Number(m));
          for (const n of nums) {
            if (!Number.isFinite(n) || n <= 0) {
              errors.priceRangeINR = 'Price must be greater than 0';
              break;
            }
            if (n > MAX_SANE_PRICE_INR) {
              errors.priceRangeINR = `Price cannot exceed ₹${MAX_SANE_PRICE_INR.toLocaleString('en-IN')}`;
              break;
            }
          }
          if (!errors.priceRangeINR && nums.length >= 2 && nums[0] > nums[1]) {
            errors.priceRangeINR = 'Minimum price cannot exceed maximum price';
          }
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

