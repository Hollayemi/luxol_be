const errorsConfig = {
    validation: {
        DEFAULT: 'Validation failed',
        INVALID_INPUT: 'Invalid input data',
        MISSING_FIELDS: 'Missing required fields',
        INVALID_EMAIL: 'Invalid email format',
        PASSWORD_TOO_SHORT: 'Password must be at least 8 characters long',
        PASSWORD_TOO_WEAK: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
    authentication: {
        DEFAULT: 'Authentication failed',
        UNAUTHORIZED: 'Unauthorized access',
        INVALID_CREDENTIALS: 'Invalid email or password',
        TOKEN_EXPIRED: 'Token has expired',
        TOKEN_INVALID: 'Invalid token',
    },
    authorization: {
        DEFAULT: 'Authorization failed',
        FORBIDDEN: 'You do not have permission to perform this action',
    },
    notFound: {
        DEFAULT: 'Resource not found',
        USER_NOT_FOUND: 'User not found',
        PRODUCT_NOT_FOUND: 'Product not found',
        ORDER_NOT_FOUND: 'Order not found',
    },
    serverError: {
        DEFAULT: 'Internal server error',
    },
    conflict: {
        DEFAULT: 'Conflict',
        EMAIL_ALREADY_EXISTS: 'Email already exists',
        USERNAME_ALREADY_EXISTS: 'Username already exists',
    },
}

export default errorsConfig