/**
 * Input validation and sanitization utilities.
 * Protects against prompt injection, oversized payloads, and malformed data.
 */

// Max items per nutrition analysis request
export const MAX_ITEMS = 100;

// Max characters for free-text fields sent to AI
const MAX_STRING_LENGTH = 200;

// Allowed unit values
const VALID_UNITS = new Set([
    'g', 'kg', 'mg', 'oz', 'lb',
    'ml', 'L', 'fl oz',
    'piece', 'pieces', 'pcs', 'unit', 'units',
    'cup', 'cups', 'tbsp', 'tsp',
    'can', 'cans', 'bottle', 'bottles',
    'pack', 'packs', 'bag', 'bags', 'box', 'boxes',
    'bunch', 'dozen', 'slice', 'slices',
    'serving', 'servings',
]);

// Allowed category values
const VALID_CATEGORIES = new Set([
    'Fruits', 'Vegetables', 'Protein', 'Dairy', 'Grains',
    'Legumes', 'Oils', 'Snacks', 'Beverages', 'Spices', 'Other',
]);

// Allowed dietary preferences
const VALID_DIETARY = new Set([
    'None', 'Vegan', 'Vegetarian', 'Keto', 'Gluten-Free',
    'Dairy-Free', 'Paleo', 'Halal', 'Kosher', 'Low-Sodium',
    'Low-Carb', 'High-Protein',
]);

// Allowed periods for analytics
const VALID_PERIODS = new Set(['week', 'month', 'year', 'all']);

/**
 * Strip characters that could be used for prompt injection or XSS.
 * Keeps alphanumeric, spaces, common punctuation for food names.
 */
export function sanitizeString(value, maxLength = MAX_STRING_LENGTH) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/[<>`{}\\]/g, '') // Remove HTML/template/shell chars
        .replace(/\n|\r/g, ' ')    // Collapse newlines into spaces
        .trim()
        .slice(0, maxLength);
}

/**
 * Validate and sanitize a grocery item object.
 * Returns { valid: boolean, item, error }
 */
export function validateItem(raw) {
    if (!raw || typeof raw !== 'object') {
        return { valid: false, error: 'Item must be an object' };
    }

    const name = sanitizeString(raw.name);
    if (!name) {
        return { valid: false, error: 'Item name is required' };
    }

    const quantity = parseFloat(raw.quantity);
    if (isNaN(quantity) || quantity <= 0 || quantity > 100000) {
        return { valid: false, error: `Invalid quantity for "${name}"` };
    }

    const unit = typeof raw.unit === 'string' ? raw.unit.trim() : 'piece';
    // Allow unknown units but sanitize them (they're not sent to DB, just to AI)
    const sanitizedUnit = VALID_UNITS.has(unit) ? unit : sanitizeString(unit, 20) || 'piece';

    const price = raw.price !== undefined ? parseFloat(raw.price) : 0;
    if (isNaN(price) || price < 0 || price > 1_000_000) {
        return { valid: false, error: `Invalid price for "${name}"` };
    }

    const category = typeof raw.category === 'string' && VALID_CATEGORIES.has(raw.category)
        ? raw.category
        : 'Other';

    return {
        valid: true,
        item: { name, quantity, unit: sanitizedUnit, price, category },
    };
}

/**
 * Validate an array of grocery items.
 * Returns { valid: boolean, items, errors }
 */
export function validateItems(rawItems) {
    if (!Array.isArray(rawItems)) {
        return { valid: false, items: [], errors: ['items must be an array'] };
    }
    if (rawItems.length === 0) {
        return { valid: false, items: [], errors: ['No items provided'] };
    }
    if (rawItems.length > MAX_ITEMS) {
        return { valid: false, items: [], errors: [`Too many items (max ${MAX_ITEMS})`] };
    }

    const items = [];
    const errors = [];

    for (let i = 0; i < rawItems.length; i++) {
        const result = validateItem(rawItems[i]);
        if (result.valid) {
            items.push(result.item);
        } else {
            errors.push(`Item ${i + 1}: ${result.error}`);
        }
    }

    if (items.length === 0) {
        return { valid: false, items: [], errors };
    }

    return { valid: true, items, errors };
}

/**
 * Validate a dietary preference string.
 */
export function validateDietary(value) {
    if (typeof value !== 'string') return 'None';
    return VALID_DIETARY.has(value) ? value : 'None';
}

/**
 * Validate a period string for analytics.
 */
export function validatePeriod(value) {
    if (typeof value !== 'string') return 'week';
    return VALID_PERIODS.has(value) ? value : 'week';
}

/**
 * Validate a positive integer within bounds.
 */
export function validatePositiveInt(value, min = 1, max = 10000, fallback = min) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < min || n > max) return fallback;
    return n;
}

/**
 * Validate upload file: type and size.
 * maxBytes defaults to 10 MB.
 */
export function validateUploadedFile(file, allowedMimeTypes, maxBytes = 10 * 1024 * 1024) {
    if (!file) return { valid: false, error: 'No file provided' };

    const mimeType = file.type || '';
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
        return { valid: false, error: `Invalid file type: ${mimeType}` };
    }

    const size = file.size || 0;
    if (size > maxBytes) {
        return {
            valid: false,
            error: `File too large (${(size / 1024 / 1024).toFixed(1)} MB). Max allowed: ${maxBytes / 1024 / 1024} MB`,
        };
    }

    return { valid: true };
}

/**
 * Generate a random request ID for tracing.
 */
export function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
