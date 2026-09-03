import jwt from 'jsonwebtoken';
import { env } from '../configs/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

// User authentication middleware
const authUser = asyncHandler(async (req, res, next) => {
    const { token } = req.headers;

    if (!token) {
        throw new AppError('Not authorized. Please log in again.', 401);
    }

    // A bad/expired token makes jwt.verify throw — asyncHandler forwards it,
    // and errorHandler maps JsonWebTokenError / TokenExpiredError to 401.
    const tokenDecode = jwt.verify(token, env.JWT_SECRET);

    if (!tokenDecode.id) {
        throw new AppError('Not authorized. Please log in again.', 401);
    }

    // Attach the user id to the request for the controllers to use.
    req.body.userId = tokenDecode.id;

    next();
});

export default authUser;
