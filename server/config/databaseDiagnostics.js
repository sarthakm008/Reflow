export function logDatabaseFailure(context, error, logger = console.error) {
  const rawMessage = String(error?.message || 'Unknown database error');
  const safeMessage = rawMessage
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[redacted MongoDB URI]')
    .replace(/(password|passwd|pwd)=([^&\s]+)/gi, '$1=[redacted]');

  logger('[Reflow API] MongoDB connection failed', {
    context,
    category: error?.name || 'Error',
    code: error?.code || undefined,
    message: safeMessage,
  });
}

export async function connectWithDiagnostics(connectDatabase, uri, context, logger = console.error) {
  try {
    return await connectDatabase(uri);
  } catch (error) {
    logDatabaseFailure(context, error, logger);
    throw error;
  }
}
