// Public destinations are fixed when Next.js builds the marketing app.
const configuredOrigin = process.env.NEXT_PUBLIC_CUSTOMER_APP_ORIGIN;
const origin = new URL(configuredOrigin || 'http://127.0.0.1:4200');
if (
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.username || origin.password || origin.pathname !== '/' ||
  origin.search || origin.hash
) {
  throw new Error('NEXT_PUBLIC_CUSTOMER_APP_ORIGIN must be an HTTP(S) origin without a path, credentials, query or fragment.');
}

export const customerLinks = {
  login: new URL('/login', origin).href,
  register: new URL('/register', origin).href,
};
