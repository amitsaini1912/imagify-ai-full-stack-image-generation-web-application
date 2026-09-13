// Single source of truth for pricing plans. Used by planSchema (validates planId),
// the payment controllers (looks up credits/amount), and GET /api/plans (the client
// fetches this instead of keeping its own hardcoded copy in assets.js).
export const PLANS = {
    Basic: { id: 'Basic', credits: 100, amount: 10, desc: 'Best for personal use.' },
    Advanced: { id: 'Advanced', credits: 500, amount: 50, desc: 'Best for business use.' },
    Business: { id: 'Business', credits: 5000, amount: 250, desc: 'Best for enterprise use.' },
}
