import jwt from 'jsonwebtoken';
import { env } from '../configs/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

// User authentication middleware
const authUser = asyncHandler(async (req, res, next) => {
    const { authorization } = req.headers;

    // Standard header shape: "Authorization: Bearer <token>".
    if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new AppError('Not authorized. Please log in again.', 401);
    }

    const token = authorization.slice('Bearer '.length);

    // A bad/expired token makes jwt.verify throw — asyncHandler forwards it,
    // and errorHandler maps JsonWebTokenError / TokenExpiredError to 401.
    const tokenDecode = jwt.verify(token, env.JWT_SECRET);

    if (!tokenDecode.id) {
        throw new AppError('Not authorized. Please log in again.', 401);
    }

    // Identity lives on req.user, never req.body — req.body belongs to the
    // request's own payload and gets fully overwritten by validate() below.
    req.user = { id: tokenDecode.id };

    next();
});

export default authUser;
