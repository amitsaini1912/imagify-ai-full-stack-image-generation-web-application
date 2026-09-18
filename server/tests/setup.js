// Runs before every test file. configs/env.js validates process.env at import time and
// process.exit(1)s on anything missing — so every required var needs a dummy value here
// before any test imports a module that (transitively) imports env.js. No real DB/API
// keys are used anywhere in the suite; nothing here ever makes a network call.
process.env.NODE_ENV = 'test'
// Quiets pino-http's request-completion lines (info/warn) in test output — real errors
// (fatal) would still show. Integration tests (Day 18) exercise the real logger; unit
// tests stub req.log directly and never touch this.
process.env.LOG_LEVEL = 'fatal'
process.env.MONGODB_URI = 'mongodb://localhost/imagify-test'
process.env.JWT_SECRET = 'test-jwt-secret-not-real'
process.env.CLIPDROP_API = 'test-clipdrop-key'
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
process.env.CLOUDINARY_API_KEY = 'test-cloudinary-key'
process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret'
process.env.RAZORPAY_KEY_ID = 'test-razorpay-id'
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
