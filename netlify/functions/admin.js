const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const adminPassword = process.env.ADMIN_PASSWORD;

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

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
    'Set-Cookie': body.cookie || '',
  },
  body: JSON.stringify(body),
});

exports.handler = async function (event) {
  const requestOrigin = event.headers.origin || event.headers.Origin || '*';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: createCorsHeaders(requestOrigin),
    };
  }

  const path = event.path.replace('/.netlify/functions/admin', '');

  // POST /login
  if (event.httpMethod === 'POST' && path === '/login') {
    try {
      if (!adminPassword) {
        console.error('Missing ADMIN_PASSWORD environment variable');
        return buildResponse(500, { 
          success: false, 
          error: 'Server configuration error: Admin password not configured' 
        }, requestOrigin);
      }

      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return buildResponse(400, { 
          success: false, 
          error: 'Invalid JSON in request body' 
        }, requestOrigin);
      }

      const { password } = body;

      if (!password) {
        return buildResponse(400, { 
          success: false, 
          error: 'Password is required' 
        }, requestOrigin);
      }

      if (password !== adminPassword) {
        return buildResponse(401, { 
          success: false, 
          error: 'Invalid password' 
        }, requestOrigin);
      }

      // Generate a session token
      const sessionToken = Buffer.from(`${Date.now()}:${Math.random().toString(36).substring(7)}`).toString('base64');

      // Set secure cookie for admin session
      const isProduction = event.headers.host && !event.headers.host.includes('localhost');
      const sameSite = isProduction ? 'Strict' : 'Lax';
      const secure = isProduction ? '; Secure' : '';
      const cookieValue = `adminSession=${sessionToken}; HttpOnly; Path=/; SameSite=${sameSite}${secure}; Max-Age=86400`;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          ...createCorsHeaders(requestOrigin),
          'Set-Cookie': cookieValue,
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'Login successful',
          token: sessionToken
        }),
      };
    } catch (error) {
      console.error('Login error:', error);
      return buildResponse(500, { 
        success: false, 
        error: 'Login failed: ' + error.message 
      }, requestOrigin);
    }
  }

  // POST /logout
  if (event.httpMethod === 'POST' && path === '/logout') {
    const isProduction = event.headers.host && !event.headers.host.includes('localhost');
    const sameSite = isProduction ? 'Strict' : 'Lax';
    const secure = isProduction ? '; Secure' : '';
    const cookieValue = `adminSession=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=${sameSite}${secure}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...createCorsHeaders(requestOrigin),
        'Set-Cookie': cookieValue,
      },
      body: JSON.stringify({ success: true, message: 'Logout successful' }),
    };
  }

  // GET /verify
  if (event.httpMethod === 'GET' && path === '/verify') {
    try {
      const cookies = event.headers.cookie || '';
      const adminSessionMatch = cookies.match(/adminSession=([^;]*)/);
      const isAuthenticated = !!adminSessionMatch && adminSessionMatch[1] && adminSessionMatch[1] !== '';

      return buildResponse(200, { 
        authenticated: isAuthenticated 
      }, requestOrigin);
    } catch (error) {
      console.error('Verify error:', error);
      return buildResponse(500, { 
        authenticated: false, 
        error: 'Verification failed' 
      }, requestOrigin);
    }
  }

  // GET /feedback-stats
  if (event.httpMethod === 'GET' && path === '/feedback-stats') {
    try {
      // Check authentication
      const cookies = event.headers.cookie || '';
      const adminSessionMatch = cookies.match(/adminSession=([^;]*)/);
      const isAuthenticated = !!adminSessionMatch && adminSessionMatch[1] && adminSessionMatch[1] !== '';

      if (!isAuthenticated) {
        return buildResponse(401, { 
          success: false, 
          error: 'Unauthorized' 
        }, requestOrigin);
      }

      if (!supabase) {
        return buildResponse(500, { 
          success: false, 
          error: 'Database not configured' 
        }, requestOrigin);
      }

      // Fetch all feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('video_feedback')
        .select('rating_value, created_at, video_id, search_query');

      if (feedbackError) {
        console.error('Supabase error:', feedbackError);
        const feedbackErrorMessage = feedbackError.message || feedbackError.details || feedbackError.code || JSON.stringify(feedbackError);
        return buildResponse(500, { 
          success: false, 
          error: 'Failed to fetch feedback: ' + (feedbackErrorMessage || 'Unknown Supabase error'),
          details: feedbackError
        }, requestOrigin);
      }

      // Calculate statistics
      const totalFeedback = feedbackData?.length || 0;
      const breakdown = { '1': 0, '2': 0, '3': 0 };
      
      feedbackData?.forEach(item => {
        if (item.rating_value === 1 || item.rating_value === 2 || item.rating_value === 3) {
          breakdown[item.rating_value.toString()]++;
        }
      });

      const recentFeedback = feedbackData
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50)
        .map(item => ({
          id: item.video_id,
          rating: item.rating_value,
          timestamp: item.created_at,
          searchQuery: item.search_query
        })) || [];

      return buildResponse(200, {
        success: true,
        totalFeedback,
        breakdown,
        recentFeedback
      }, requestOrigin);
    } catch (error) {
      console.error('Feedback stats error:', error);
      return buildResponse(500, { 
        success: false, 
        error: 'Failed to fetch feedback stats: ' + error.message 
      }, requestOrigin);
    }
  }

  return buildResponse(404, { 
    success: false, 
    error: 'Endpoint not found' 
  }, requestOrigin);
};
