// Full OpenAPI 3.0 spec for the Act On Issues API — mounted at /api-docs by
// swagger.js. Kept as its own file (rather than inline in swagger.js)
// because it's large; see docs/API.md for the same reference in prose form,
// with request/response examples and integration notes that don't belong in
// a machine-readable spec. Keep both in sync when routes change.
const success = { type: 'object', properties: { success: { type: 'boolean', example: true } } };
const errorResponse = {
  description: 'Error',
  content: { 'application/json': { schema: { type: 'object', properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' }
  } } } }
};

const sessionUser = {
  type: 'object',
  properties: {
    _id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' },
    phone: { type: 'string' }, userId: { type: 'string' }, userIdChangeCount: { type: 'integer' },
    role: { type: 'string', enum: ['Citizen', 'Authority', 'Admin'], description: "Stored value — shown on screen as Member/Admin/Super Admin respectively, see docs/API.md" },
    avatar: { type: 'string' }, banner: { type: 'string' },
    isDisabled: { type: 'boolean' }, hasPassword: { type: 'boolean' }, mustChangePassword: { type: 'boolean' }
  }
};

const issue = {
  type: 'object',
  properties: {
    _id: { type: 'string' }, issueNumber: { type: 'string', example: 'AOI-000123' },
    title: { type: 'string' }, description: { type: 'string' },
    category: { type: 'string' }, topic: { type: 'string' }, subTopic: { type: 'string' },
    customCategory: { type: 'string' },
    status: { type: 'string', enum: ['Open', 'In Progress', 'Escalated', 'Resolved', 'Rejected'] },
    priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
    moderationStatus: { type: 'string', enum: ['Pending', 'Approved', 'Rejected'] },
    location: { type: 'object', properties: {
      address: { type: 'string' }, city: { type: 'string' }, ward: { type: 'string' },
      district: { type: 'string' }, mandal: { type: 'string' }, state: { type: 'string' },
      country: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' }
    } },
    reporter: { type: 'object' }, assignee: { type: 'object' },
    supportCount: { type: 'integer' }, disagreeCount: { type: 'integer' },
    featured: { type: 'boolean' }, commentsLocked: { type: 'boolean' },
    attachments: { type: 'array', items: { type: 'object', properties: {
      fileName: { type: 'string' }, originalName: { type: 'string' }, url: { type: 'string' }
    } } },
    createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }
  }
};

const comment = {
  type: 'object',
  properties: {
    _id: { type: 'string' }, issue: { type: 'string' }, user: { type: 'object' },
    text: { type: 'string' }, parentComment: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

const announcement = {
  type: 'object',
  properties: {
    _id: { type: 'string' }, text: { type: 'string' },
    mood: { type: 'string', enum: ['announce', 'celebrate', 'warning', 'sad', 'love'] },
    postedBy: { type: 'object' },
    startAt: { type: 'string', format: 'date-time', nullable: true },
    endAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

const heroQuote = {
  type: 'object',
  properties: { _id: { type: 'string' }, text: { type: 'string' }, postedBy: { type: 'object' } }
};

const adminUser = {
  type: 'object',
  properties: {
    _id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' },
    userId: { type: 'string' }, role: { type: 'string', enum: ['Citizen', 'Authority', 'Admin'] },
    isDisabled: { type: 'boolean' }, canCreateCitizens: { type: 'boolean' }, canAccessHomeFeed: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

const cookieAuth = [{ sessionCookie: [] }];

// Small helper so every 2xx response is wrapped the same way this API
// actually wraps it — { success: true, <dataKey>: <schema> } — without
// repeating the boilerplate at every path.
function ok(dataKey, schema, description = 'Success') {
  const properties = { success: { type: 'boolean', example: true } };
  if (dataKey) properties[dataKey] = schema;
  return { description, content: { 'application/json': { schema: { type: 'object', properties } } } };
}

module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'Act On Issues API',
    version: '1.1.0',
    description: 'Civic issue-reporting platform API. See docs/API.md in the repo for a fuller prose reference, integration notes, and examples — this spec covers the same endpoints in machine-readable form.'
  },
  servers: [
    { url: 'https://actonissues.com/api', description: 'Production' },
    { url: 'http://localhost:3001/api', description: 'Local development' }
  ],
  components: {
    securitySchemes: {
      sessionCookie: { type: 'apiKey', in: 'cookie', name: 'connect.sid', description: 'Set by POST /auth/login or any other sign-in endpoint. Send it back on every subsequent request.' }
    },
    schemas: { sessionUser, issue, comment, announcement, heroQuote, adminUser }
  },
  tags: [
    { name: 'Auth' }, { name: 'Issues' }, { name: 'Comments' }, { name: 'Activity' },
    { name: 'Notifications' }, { name: 'Push' }, { name: 'Attachments' }, { name: 'Ludo' },
    { name: 'Announcements' }, { name: 'Hero Quotes' }, { name: 'Admin' }, { name: 'Uploads' }, { name: 'Health' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'], summary: 'Uptime probe', security: [],
        responses: { 200: ok(null, { type: 'object', properties: { status: { type: 'string', example: 'UP' }, timestamp: { type: 'string', format: 'date-time' }, uptime: { type: 'number' } } }) }
      }
    },

    '/auth/check-availability': {
      get: {
        tags: ['Auth'], summary: 'Check if an email/phone/User ID is already taken', security: [],
        parameters: [
          { name: 'email', in: 'query', schema: { type: 'string' } },
          { name: 'phone', in: 'query', schema: { type: 'string' } },
          { name: 'userId', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: ok('available', { type: 'boolean' }), 400: errorResponse }
      }
    },
    '/auth/register-with-phone': {
      post: {
        tags: ['Auth'], summary: 'Create an account (the only self-registration path — phone-verified)', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['idToken', 'firstName', 'lastName', 'userId', 'password', 'email', 'acceptedTerms'], properties: {
          idToken: { type: 'string', description: 'Firebase phone-auth ID token' },
          firstName: { type: 'string' }, lastName: { type: 'string' },
          userId: { type: 'string', description: '3-30 chars: a-z 0-9 . _ @ -' },
          password: { type: 'string', description: '8-16 chars, upper+lower+digit+special' },
          email: { type: 'string', format: 'email' }, acceptedTerms: { type: 'boolean' }
        } } } } },
        responses: { 201: ok('user', sessionUser), 400: errorResponse, 401: errorResponse, 409: errorResponse }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in with email, phone, or User ID + password', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['identifier', 'password'], properties: {
          identifier: { type: 'string', description: 'Email, phone, or User ID' }, password: { type: 'string' }
        } } } } },
        responses: { 200: ok('user', sessionUser), 401: errorResponse, 403: errorResponse, 429: errorResponse }
      }
    },
    '/auth/google': {
      post: {
        tags: ['Auth'], summary: 'Sign in / register via Google ID token', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['credential'], properties: {
          credential: { type: 'string' }, acceptedTerms: { type: 'boolean', description: 'Required only when this creates a new account' }
        } } } } },
        responses: { 200: ok('user', sessionUser), 400: errorResponse, 401: errorResponse, 403: errorResponse }
      }
    },
    '/auth/firebase-phone': {
      post: {
        tags: ['Auth'], summary: 'Sign in / register via a verified Firebase phone token', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['idToken'], properties: {
          idToken: { type: 'string' }, name: { type: 'string', description: 'Required only when this creates a new account' }
        } } } } },
        responses: { 200: ok('user', sessionUser), 400: errorResponse, 401: errorResponse, 403: errorResponse }
      }
    },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Log out', security: cookieAuth, responses: { 200: ok(null, {}), 401: errorResponse } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current session user', security: [], responses: { 200: ok('user', sessionUser), 401: errorResponse } } },
    '/auth/me/user-id': {
      patch: {
        tags: ['Auth'], summary: 'Change User ID (max 3 changes ever)', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } } } } },
        responses: { 200: ok('user', sessionUser), 400: errorResponse, 403: errorResponse, 409: errorResponse }
      }
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'], summary: 'Change password', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['newPassword'], properties: {
          currentPassword: { type: 'string', description: 'Required only if the account already has a password' }, newPassword: { type: 'string' }
        } } } } },
        responses: { 200: ok('user', sessionUser), 400: errorResponse, 401: errorResponse }
      }
    },
    '/auth/otp/request': {
      post: {
        tags: ['Auth'], summary: 'Request an email OTP code', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['identifier'], properties: { identifier: { type: 'string', format: 'email' } } } } } },
        responses: { 200: ok(null, {}), 400: errorResponse, 429: errorResponse, 503: errorResponse }
      }
    },
    '/auth/otp/verify': {
      post: {
        tags: ['Auth'], summary: 'Verify an email OTP code (logs in / registers)', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['identifier', 'code'], properties: {
          identifier: { type: 'string' }, code: { type: 'string' }, name: { type: 'string', description: 'Required only for a new account' }
        } } } } },
        responses: { 200: ok('user', sessionUser), 400: errorResponse, 403: errorResponse }
      }
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'], summary: 'Request a password-reset code by email', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { 200: ok(null, {}, 'Always the same response whether or not the account exists'), 400: errorResponse, 429: errorResponse, 503: errorResponse }
      }
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'], summary: 'Reset password using an emailed code', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'code', 'newPassword'], properties: {
          email: { type: 'string' }, code: { type: 'string' }, newPassword: { type: 'string' }
        } } } } },
        responses: { 200: ok('user', sessionUser), 400: errorResponse, 404: errorResponse }
      }
    },

    '/issues': {
      get: {
        tags: ['Issues'], summary: 'List / search / filter issues', security: [],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Open', 'In Progress', 'Escalated', 'Resolved', 'Rejected'] } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['Low', 'Medium', 'High'] } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Substring match against title/description' },
          { name: 'location', in: 'query', schema: { type: 'string' }, description: 'Substring match against state/district/mandal/city/address' },
          { name: 'lat', in: 'query', schema: { type: 'number' }, description: 'With lng, filters by distance instead of the location substring match' },
          { name: 'lng', in: 'query', schema: { type: 'number' } },
          { name: 'radiusKm', in: 'query', schema: { type: 'number' }, description: 'Default 10, max 200 — only used with lat/lng' },
          { name: 'mine', in: 'query', schema: { type: 'boolean' }, description: 'Requires login — only the caller\'s own issues' },
          { name: 'moderation', in: 'query', schema: { type: 'string', enum: ['all'] }, description: 'Staff only — skip the Approved-only default filter' }
        ],
        responses: { 200: ok('issues', { type: 'array', items: issue }) }
      },
      post: {
        tags: ['Issues'], summary: 'Create an issue', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'description', 'topic', 'subTopic'], properties: {
          title: { type: 'string' }, description: { type: 'string' },
          topic: { type: 'string' }, subTopic: { type: 'string' },
          customCategory: { type: 'string', description: 'Required if topic or subTopic is "Other"' },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          location: { type: 'object', description: 'Either "address" or state+district+city all three' }
        } } } } },
        responses: { 201: ok('issue', issue), 400: errorResponse, 401: errorResponse }
      }
    },
    '/issues/meta': { get: { tags: ['Issues'], summary: 'Category/topic/status/priority enum reference', security: [], responses: { 200: ok(null, { type: 'object' }) } } },
    '/issues/stats': { get: { tags: ['Issues'], summary: 'Aggregate counts', security: [], responses: { 200: ok('stats', { type: 'object', properties: { total: { type: 'integer' }, open: { type: 'integer' }, inProgress: { type: 'integer' }, resolved: { type: 'integer' }, pending: { type: 'integer' } } }) } } },
    '/issues/category-counts': { get: { tags: ['Issues'], summary: 'Approved-issue counts by category', security: [], responses: { 200: ok('categories', { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, count: { type: 'integer' } } } }) } } },
    '/issues/top-reporters': { get: { tags: ['Issues'], summary: 'Top 5 reporters by approved-issue count', security: [], responses: { 200: ok('reporters', { type: 'array', items: { type: 'object' } }) } } },
    '/issues/featured': { get: { tags: ['Issues'], summary: '"Hot" issues (max 15)', security: [], responses: { 200: ok('issues', { type: 'array', items: issue }) } } },
    '/issues/{id}': {
      get: {
        tags: ['Issues'], summary: 'Get a single issue', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('issue', issue), 404: errorResponse }
      },
      patch: {
        tags: ['Issues'], summary: 'Update an issue (owner: title/description/category; staff: also priority/assignee/status/featured/commentsLocked/moderationStatus)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: ok('issue', issue), 400: errorResponse, 403: errorResponse, 404: errorResponse }
      },
      delete: {
        tags: ['Issues'], summary: 'Delete an issue (owner or staff)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok(null, {}), 403: errorResponse, 404: errorResponse }
      }
    },
    '/issues/{id}/support': {
      post: {
        tags: ['Issues'], summary: 'Toggle support/upvote (mutually exclusive with disagree)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok(null, { type: 'object', properties: { supportCount: { type: 'integer' }, supported: { type: 'boolean' }, disagreeCount: { type: 'integer' }, disagreed: { type: 'boolean' } } }), 404: errorResponse }
      }
    },
    '/issues/{id}/disagree': {
      post: {
        tags: ['Issues'], summary: 'Toggle disagree (mutually exclusive with support)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok(null, { type: 'object', properties: { supportCount: { type: 'integer' }, supported: { type: 'boolean' }, disagreeCount: { type: 'integer' }, disagreed: { type: 'boolean' } } }), 404: errorResponse }
      }
    },

    '/comments/{issueId}': {
      get: {
        tags: ['Comments'], summary: 'List comments on an issue', security: [],
        parameters: [{ name: 'issueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('comments', { type: 'array', items: comment }) }
      },
      post: {
        tags: ['Comments'], summary: 'Add a comment (or reply)', security: cookieAuth,
        parameters: [{ name: 'issueId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, parentComment: { type: 'string', nullable: true } } } } } },
        responses: { 201: ok('comment', comment), 400: errorResponse, 403: errorResponse, 404: errorResponse }
      }
    },
    '/comments/{issueId}/{commentId}': {
      delete: {
        tags: ['Comments'], summary: 'Delete a comment (author or staff; cascades to replies)', security: cookieAuth,
        parameters: [
          { name: 'issueId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'commentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: ok(null, {}), 403: errorResponse, 404: errorResponse }
      }
    },

    '/activity/{issueId}': {
      get: {
        tags: ['Activity'], summary: 'Activity timeline for an issue', security: [],
        parameters: [{ name: 'issueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('activities', { type: 'array', items: { type: 'object', properties: { user: { type: 'object' }, action: { type: 'string' }, details: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } } }) }
      }
    },

    '/notifications': { get: { tags: ['Notifications'], summary: "List the caller's notifications", security: cookieAuth, responses: { 200: ok(null, { type: 'object', properties: { notifications: { type: 'array', items: { type: 'object' } }, unread: { type: 'integer' } } }) } } },
    '/notifications/{id}/read': { post: { tags: ['Notifications'], summary: 'Mark one notification read', security: cookieAuth, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok(null, {}) } } },
    '/notifications/read-all': { post: { tags: ['Notifications'], summary: 'Mark all notifications read', security: cookieAuth, responses: { 200: ok(null, {}) } } },

    '/push/vapid-public-key': { get: { tags: ['Push'], summary: 'Get the VAPID public key for subscribing', security: [], responses: { 200: ok('publicKey', { type: 'string' }), 503: errorResponse } } },
    '/push/subscribe': {
      post: {
        tags: ['Push'], summary: 'Register a Web Push subscription', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['endpoint', 'keys'], properties: {
          endpoint: { type: 'string' }, keys: { type: 'object', required: ['p256dh', 'auth'], properties: { p256dh: { type: 'string' }, auth: { type: 'string' } } }
        } } } } },
        responses: { 200: ok(null, {}), 400: errorResponse }
      }
    },
    '/push/unsubscribe': { post: { tags: ['Push'], summary: 'Remove a Web Push subscription', security: cookieAuth, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { endpoint: { type: 'string' } } } } } }, responses: { 200: ok(null, {}) } } },

    '/attachments/{issueId}': {
      post: {
        tags: ['Attachments'], summary: 'Upload up to 6 files to an issue (owner or staff)', security: cookieAuth,
        parameters: [{ name: 'issueId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { attachments: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
        responses: { 201: ok('attachments', { type: 'array', items: { type: 'object' } }), 400: errorResponse, 403: errorResponse, 404: errorResponse }
      }
    },
    '/attachments/{issueId}/{attachmentId}': {
      delete: {
        tags: ['Attachments'], summary: 'Remove an attachment (owner or staff)', security: cookieAuth,
        parameters: [
          { name: 'issueId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'attachmentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: ok('attachments', { type: 'array', items: { type: 'object' } }), 403: errorResponse, 404: errorResponse }
      }
    },

    '/games/ludo/active': { get: { tags: ['Ludo'], summary: "Caller's active/waiting room, if any", security: cookieAuth, responses: { 200: ok('room', { type: 'object', nullable: true }) } } },
    '/games/ludo/rooms': {
      post: {
        tags: ['Ludo'], summary: 'Create a room (auto-joins as host)', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['targetPlayers'], properties: { targetPlayers: { type: 'integer', enum: [2, 3, 4] } } } } } },
        responses: { 200: ok('room', { type: 'object' }), 400: errorResponse }
      }
    },
    '/games/ludo/rooms/{code}': {
      get: {
        tags: ['Ludo'], summary: 'Poll room state', security: cookieAuth,
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('room', { type: 'object' }), 403: errorResponse, 404: errorResponse }
      },
      patch: {
        tags: ['Ludo'], summary: "Push a move (optimistic concurrency via expectedVersion)", security: cookieAuth,
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['expectedVersion', 'state', 'turnIdx'], properties: {
          expectedVersion: { type: 'integer' }, state: { type: 'object' }, turnIdx: { type: 'integer' }, winner: { type: 'string', nullable: true }
        } } } } },
        responses: { 200: ok('room', { type: 'object' }), 400: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse }
      }
    },
    '/games/ludo/rooms/{code}/join': { post: { tags: ['Ludo'], summary: 'Join a room', security: cookieAuth, parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok('room', { type: 'object' }), 404: errorResponse, 409: errorResponse } } },
    '/games/ludo/rooms/{code}/leave': { post: { tags: ['Ludo'], summary: 'Leave a room (pre-game only)', security: cookieAuth, parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok('room', { type: 'object', nullable: true }), 400: errorResponse, 404: errorResponse } } },

    '/announcements': { get: { tags: ['Announcements'], summary: 'Currently-active announcements', security: [], responses: { 200: ok('announcements', { type: 'array', items: announcement }) } } },
    '/admin/announcements': {
      get: { tags: ['Announcements'], summary: 'Every announcement, regardless of schedule (staff)', security: cookieAuth, responses: { 200: ok('announcements', { type: 'array', items: announcement }), 403: errorResponse } },
      post: {
        tags: ['Announcements'], summary: 'Create an announcement (staff)', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: {
          text: { type: 'string', maxLength: 280 }, mood: { type: 'string', enum: ['announce', 'celebrate', 'warning', 'sad', 'love'] },
          startAt: { type: 'string', format: 'date-time', nullable: true }, endAt: { type: 'string', format: 'date-time', nullable: true }
        } } } } },
        responses: { 201: ok('announcement', announcement), 400: errorResponse, 403: errorResponse }
      }
    },
    '/admin/announcements/{id}': {
      patch: { tags: ['Announcements'], summary: 'Update an announcement (staff)', security: cookieAuth, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: ok('announcement', announcement), 400: errorResponse, 403: errorResponse, 404: errorResponse } },
      delete: { tags: ['Announcements'], summary: 'Delete an announcement (staff)', security: cookieAuth, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok(null, {}), 403: errorResponse, 404: errorResponse } }
    },

    '/hero-quotes': { get: { tags: ['Hero Quotes'], summary: 'Home hero headline quotes + eyebrow/description overrides', security: [], responses: { 200: ok(null, { type: 'object', properties: { quotes: { type: 'array', items: heroQuote }, eyebrowText: { type: 'string' }, descriptionText: { type: 'string' } } }) } } },
    '/admin/hero-quotes': {
      get: { tags: ['Hero Quotes'], summary: 'All hero quotes (Admin only)', security: cookieAuth, responses: { 200: ok('quotes', { type: 'array', items: heroQuote }), 403: errorResponse } },
      post: {
        tags: ['Hero Quotes'], summary: 'Add a hero quote (Admin only)', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string', maxLength: 120 } } } } } },
        responses: { 201: ok('quote', heroQuote), 400: errorResponse, 403: errorResponse }
      }
    },
    '/admin/hero-quotes/{id}': {
      patch: { tags: ['Hero Quotes'], summary: 'Update a hero quote (Admin only)', security: cookieAuth, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string', maxLength: 120 } } } } } }, responses: { 200: ok('quote', heroQuote), 400: errorResponse, 403: errorResponse, 404: errorResponse } },
      delete: { tags: ['Hero Quotes'], summary: 'Delete a hero quote (Admin only)', security: cookieAuth, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok(null, {}), 403: errorResponse, 404: errorResponse } }
    },

    '/founder-image': {
      get: { tags: ['Founder Image'], summary: "Founder's Message photo URL, shown on the About page (empty url if unset)", security: [], responses: { 200: ok(null, { type: 'object', properties: { url: { type: 'string' } } }) } },
      post: { tags: ['Founder Image'], summary: 'Upload/replace the founder photo (staff only)', security: cookieAuth, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } } } }, responses: { 200: ok(null, { type: 'object', properties: { url: { type: 'string' } } }), 400: errorResponse, 403: errorResponse } },
      delete: { tags: ['Founder Image'], summary: 'Remove the founder photo, reverting to the placeholder (staff only)', security: cookieAuth, responses: { 200: ok(null, {}), 403: errorResponse } }
    },

    '/admin/reports': { get: { tags: ['Admin'], summary: 'Dashboard summary (staff)', security: cookieAuth, responses: { 200: ok(null, { type: 'object', properties: { summary: { type: 'object' }, byCategory: { type: 'array', items: { type: 'object' } } } }), 403: errorResponse } } },
    '/admin/users': { get: { tags: ['Admin'], summary: 'List users — Authority sees Citizen accounts only (staff)', security: cookieAuth, responses: { 200: ok('users', { type: 'array', items: adminUser }), 403: errorResponse } } },
    '/admin/roles': { get: { tags: ['Admin'], summary: 'List roles (staff)', security: cookieAuth, responses: { 200: ok('roles', { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } }), 403: errorResponse } } },
    '/admin/users/{id}': {
      patch: {
        tags: ['Admin'], summary: "Update a user — role/canCreateCitizens/canAccessHomeFeed are Admin-only fields; userId/phone scoped to Citizen targets for Authority (staff)", security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: {
          role: { type: 'string', enum: ['Citizen', 'Authority', 'Admin'] }, canCreateCitizens: { type: 'boolean' }, canAccessHomeFeed: { type: 'boolean' },
          userId: { type: 'string' }, phone: { type: 'string' }
        } } } } },
        responses: { 200: ok('user', adminUser), 400: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse }
      },
      delete: {
        tags: ['Admin'], summary: 'Delete a user account — scoped to Citizen targets for Authority (staff)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok(null, {}), 400: errorResponse, 403: errorResponse, 404: errorResponse }
      }
    },
    '/admin/users/{id}/reset-password': {
      post: {
        tags: ['Admin'], summary: 'Reset a user\'s password, optionally auto-generated (staff)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { newPassword: { type: 'string' } } } } } },
        responses: { 200: ok('generatedPassword', { type: 'string' }, 'generatedPassword only present if newPassword was omitted'), 400: errorResponse, 403: errorResponse, 404: errorResponse }
      }
    },
    '/admin/users/{id}/status': {
      patch: {
        tags: ['Admin'], summary: 'Enable/disable a user account (staff)', security: cookieAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['isDisabled'], properties: { isDisabled: { type: 'boolean' } } } } } },
        responses: { 200: ok('user', adminUser), 400: errorResponse, 403: errorResponse, 404: errorResponse }
      }
    },
    '/admin/audit': { get: { tags: ['Admin'], summary: 'Audit log, last 200 entries (Admin only)', security: cookieAuth, responses: { 200: ok('logs', { type: 'array', items: { type: 'object' } }), 403: errorResponse } } },
    '/admin/settings': {
      get: { tags: ['Admin'], summary: 'System settings (Admin only)', security: cookieAuth, responses: { 200: ok('settings', { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, description: { type: 'string' } } } }), 403: errorResponse } },
      put: {
        tags: ['Admin'], summary: 'Update settings — partial list accepted (Admin only)', security: cookieAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['settings'], properties: { settings: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } } } } } } } } },
        responses: { 200: ok('settings', { type: 'array', items: { type: 'object' } }), 403: errorResponse }
      }
    },

    '/gcs/upload': {
      post: {
        tags: ['Uploads'], summary: 'Upload a file to Google Cloud Storage (only mounted when GCS_BUCKET is configured)', security: cookieAuth,
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
        responses: { 200: ok('url', { type: 'string' }), 500: errorResponse }
      }
    }
  }
};
