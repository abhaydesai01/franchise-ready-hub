import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('[mongodb] MONGODB_URI is not set');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
if (process.env.NODE_ENV !== 'production') {
  global.mongooseCache = cache;
}

function assertDbName(uri: string): void {
  // Detect "mongodb[+srv]://host[:port][,host[:port]]/<dbname>?..." pattern.
  // If dbname is missing or empty, Mongoose falls back to the `test` database,
  // which silently disconnects Freddy v2 writes from the CRM backend reads.
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/?]+(?:\/([^?]*))?/i);
  const dbName = match?.[1] ?? '';
  if (!dbName) {
    console.warn(
      '[mongodb] WARNING: MONGODB_URI does not include a database name. ' +
        'Mongoose will use the default `test` database. ' +
        'Add /franchise-ready (or your CRM db name) before the ? in the URI.',
    );
  }
}

/** Call at the start of every API route handler. */
export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    assertDbName(MONGODB_URI);
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    console.error('[mongodb] connection failed', e);
    throw e;
  }
  return cache.conn;
}
