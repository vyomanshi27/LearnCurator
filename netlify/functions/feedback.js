const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const createCorsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const buildResponse = (statusCode, body, origin) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...createCorsHeaders(origin),
  },
  body: JSON.stringify(body),
});

exports.handler = async function (event) {
  const requestOrigin = event.headers.origin || event.headers.Origin || '*';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: createCorsHeaders(requestOrigin),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { success: false, error: 'Method not allowed' }, requestOrigin);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return buildResponse(400, { success: false, error: 'Invalid JSON payload' }, requestOrigin);
  }

  const { videoId, ratingValue, comment, searchQuery } = payload;
  if (!videoId || typeof videoId !== 'string') {
    return buildResponse(400, { success: false, error: 'videoId is required and must be a string' }, requestOrigin);
  }

  const parsedRating = parseInt(ratingValue, 10);
  if (![1, 2, 3].includes(parsedRating)) {
    return buildResponse(400, { success: false, error: 'ratingValue must be 1, 2 or 3' }, requestOrigin);
  }

  const userIp = (event.headers['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();

  const { error } = await supabase.from('video_feedback').insert([
    {
      video_id: videoId,
      rating_value: parsedRating,
      comment: comment && typeof comment === 'string' ? comment : null,
      search_query: searchQuery && typeof searchQuery === 'string' ? searchQuery : null,
      user_ip: userIp,
    },
  ]);

  if (error) {
    console.error('Supabase insert error:', error);
    return buildResponse(500, { success: false, error: 'Failed to save feedback' }, requestOrigin);
  }

  return buildResponse(200, { success: true }, requestOrigin);
};
