// Hand-written OpenAPI 3.0 spec — one plain JS object, no JSDoc-comment parsing.
// A hand-written spec can drift from the real routes over time; the fix when that happens
// is updating this file alongside the route change, same as any other doc-as-code.
// Served at GET /api/docs by swagger-ui-express (see server.js).

const successEnvelope = (dataProps = {}) => ({
  type: 'object',
  properties: { success: { type: 'boolean', example: true }, ...dataProps },
})

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: 'A human-readable reason' },
  },
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: errorEnvelope } },
})

const bearerAuth = [{ bearerAuth: [] }]

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Imagify API',
    version: '1.0.0',
    description:
      'AI image generation with a credit system. Register/login for a JWT, spend credits ' +
      'to generate images (Clipdrop + Cloudinary), buy more credits via Razorpay or Stripe.',
  },
  servers: [{ url: '/api', description: 'Same-origin, relative to wherever this server is deployed' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'Basic' },
          credits: { type: 'integer', example: 100 },
          amount: { type: 'integer', example: 10, description: 'Price in the configured CURRENCY (major unit)' },
          desc: { type: 'string', example: 'Best for personal use.' },
        },
      },
      Generation: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          prompt: { type: 'string' },
          imageUrl: { type: 'string', format: 'uri' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/user/register': {
      post: {
        summary: 'Register a new user',
        tags: ['User'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 50, example: 'Amit' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: successEnvelope({
                  token: { type: 'string' },
                  user: { type: 'object', properties: { name: { type: 'string' } } },
                }),
              },
            },
          },
          400: errorResponse('Validation failed'),
          409: errorResponse('Email already in use'),
        },
      },
    },
    '/user/login': {
      post: {
        summary: 'Log in with email + password',
        tags: ['User'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged in',
            content: {
              'application/json': {
                schema: successEnvelope({
                  token: { type: 'string' },
                  user: { type: 'object', properties: { name: { type: 'string' } } },
                }),
              },
            },
          },
          401: errorResponse('Invalid email or password'),
        },
      },
    },
    '/user/plans': {
      get: {
        summary: 'List pricing plans (public)',
        tags: ['User'],
        responses: {
          200: {
            description: 'The three plans',
            content: {
              'application/json': {
                schema: successEnvelope({ plans: { type: 'array', items: { $ref: '#/components/schemas/Plan' } } }),
              },
            },
          },
        },
      },
    },
    '/user/credits': {
      get: {
        summary: "Get the logged-in user's credit balance",
        tags: ['User'],
        security: bearerAuth,
        responses: {
          200: {
            description: 'Current balance',
            content: {
              'application/json': {
                schema: successEnvelope({
                  credits: { type: 'integer' },
                  user: { type: 'object', properties: { name: { type: 'string' } } },
                }),
              },
            },
          },
          401: errorResponse('Missing/invalid/expired token'),
          404: errorResponse('User not found'),
        },
      },
    },
    '/user/pay-razor': {
      post: {
        summary: 'Create a Razorpay order for a plan',
        tags: ['Payments'],
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['planId'], properties: { planId: { type: 'string', enum: ['Basic', 'Advanced', 'Business'] } } },
            },
          },
        },
        responses: {
          200: { description: 'Razorpay order created — pass this to the Razorpay checkout widget', content: { 'application/json': { schema: successEnvelope({ order: { type: 'object' } }) } } },
          401: errorResponse('Missing/invalid/expired token'),
          404: errorResponse('User not found'),
        },
      },
    },
    '/user/verify-razor': {
      post: {
        summary: 'Verify a Razorpay payment and credit the account',
        description:
          'Called by the client after Razorpay\'s checkout widget succeeds. The signature is ' +
          'recomputed server-side (HMAC) and crediting is idempotent — replaying this call once ' +
          'a transaction is already credited returns 409, not double credits.',
        tags: ['Payments'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
                properties: {
                  razorpay_order_id: { type: 'string' },
                  razorpay_payment_id: { type: 'string' },
                  razorpay_signature: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Credits added', content: { 'application/json': { schema: successEnvelope({ message: { type: 'string', example: 'Credits added' } }) } } },
          401: errorResponse('Signature does not match'),
          404: errorResponse('Transaction not found'),
          409: errorResponse('Payment already verified (replayed call)'),
        },
      },
    },
    '/user/pay-stripe': {
      post: {
        summary: 'Create a Stripe Checkout Session for a plan',
        tags: ['Payments'],
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['planId'], properties: { planId: { type: 'string', enum: ['Basic', 'Advanced', 'Business'] } } },
            },
          },
        },
        responses: {
          200: { description: 'Session created — redirect the browser to session_url', content: { 'application/json': { schema: successEnvelope({ session_url: { type: 'string', format: 'uri' } }) } } },
          401: errorResponse('Missing/invalid/expired token'),
          404: errorResponse('User not found'),
        },
      },
    },
    '/user/verify-stripe': {
      post: {
        summary: "Verify a Stripe payment on the browser's redirect back",
        description:
          'Fast path only — this confirms payment by re-fetching the Checkout Session from ' +
          'Stripe, it never trusts the redirect\'s own ?success= param. The webhook ' +
          '(POST /webhook/stripe) is the real source of truth and credits even if the browser ' +
          'never returns; "already_processed" here is the normal happy case once the webhook won the race.',
        tags: ['Payments'],
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['transactionId'],
                properties: { transactionId: { type: 'string' }, success: { type: 'string', enum: ['true', 'false'] } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Credits added (now, or already, by the webhook)', content: { 'application/json': { schema: successEnvelope({ message: { type: 'string', example: 'Credits added' } }) } } },
          400: errorResponse('Amount mismatch, or transaction has no Stripe session'),
          402: errorResponse('Payment not completed / was cancelled'),
          404: errorResponse('Transaction not found'),
          502: errorResponse('Could not reach Stripe to confirm payment'),
        },
      },
    },
    '/image/generate-image': {
      post: {
        summary: 'Spend 1 credit to generate an image from a prompt',
        description:
          'Credit deduction is atomic and happens before the Clipdrop call, so two concurrent ' +
          'requests at balance 1 can\'t both succeed. The credit is refunded if Clipdrop or the ' +
          'Cloudinary upload fails after it was already spent.',
        tags: ['Image'],
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['prompt'], properties: { prompt: { type: 'string', minLength: 1, maxLength: 1000 } } },
            },
          },
        },
        responses: {
          200: {
            description: 'Image generated and uploaded',
            content: {
              'application/json': {
                schema: successEnvelope({
                  message: { type: 'string', example: 'Image generated' },
                  resultImage: { type: 'string', format: 'uri' },
                  creditBalance: { type: 'integer' },
                }),
              },
            },
          },
          401: errorResponse('Missing/invalid/expired token'),
          402: errorResponse('No credit balance'),
          404: errorResponse('User not found'),
          429: errorResponse('Rate limit exceeded (10 requests / 15 min per IP)'),
          502: errorResponse('Clipdrop or Cloudinary unavailable — credit was refunded'),
        },
      },
    },
    '/image/history': {
      get: {
        summary: "List the logged-in user's past generations, newest first",
        tags: ['Image'],
        security: bearerAuth,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 12 } },
        ],
        responses: {
          200: {
            description: 'A page of generations',
            content: {
              'application/json': {
                schema: successEnvelope({
                  generations: { type: 'array', items: { $ref: '#/components/schemas/Generation' } },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                      total: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                }),
              },
            },
          },
          400: errorResponse('page/limit out of range'),
          401: errorResponse('Missing/invalid/expired token'),
        },
      },
    },
    '/webhook/stripe': {
      post: {
        summary: 'Stripe webhook — server-to-server only, not for API clients',
        description:
          'Stripe calls this directly with a raw signed body; it is the real source of truth ' +
          'for crediting (fires even if the buyer\'s browser never returns). Not callable ' +
          'usefully from outside Stripe since the signature check will reject anything else.',
        tags: ['Payments'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Event received and processed (or ignored, if not a checkout event)' },
          400: { description: 'Signature verification failed' },
        },
      },
    },
  },
}
