/**
 * Feedback Routes
 * Handles user feedback collection
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const adminToken = process.env.FEEDBACK_STATS_TOKEN;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCookie(cookieHeader) {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((acc, cookie) => {
      const [name, ...value] = cookie.split('=');
      acc[name] = decodeURIComponent(value.join('='));
      return acc;
    }, {});
}

function authorizeFeedbackStats(req, res) {
  const token = req.headers['x-admin-token'] || req.query.adminToken;
  if (!adminToken || token !== adminToken) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

function isAdminAuthenticated(req, res) {
  const cookies = parseCookie(req.headers.cookie || '');
  if (cookies.adminSession === 'true') {
    return true;
  }

  res.status(401).json({ success: false, error: 'Unauthorized' });
  return false;
}

/**
 * POST /api/feedback
 * Stores user video feedback in Supabase
 */
router.post('/feedback', async (req, res) => {
  try {
    const { videoId, ratingValue, comment, searchQuery } = req.body;

    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ success: false, error: 'videoId is required and must be a string' });
    }

    const parsedRating = parseInt(ratingValue, 10);
    if (![1, 2, 3].includes(parsedRating)) {
      return res.status(400).json({ success: false, error: 'ratingValue must be 1, 2 or 3' });
    }

    const userIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
      .toString()
      .split(',')[0]
      .trim();

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
      return res.status(500).json({ success: false, error: 'Failed to save feedback' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/login
 * Authenticates site owner and sets an http-only admin session cookie
 */
router.post('/admin/login', (req, res) => {
  if (!adminPassword) {
    return res.status(500).json({ success: false, error: 'Admin password is not configured' });
  }

  const { password } = req.body;
  if (!password || password !== adminPassword) {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }

  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'None' : 'Lax';
  const cookieValue = `adminSession=true; HttpOnly; Path=/; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieValue);
  res.json({ success: true });
});

router.post('/admin/logout', (req, res) => {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'None' : 'Lax';
  const cookieValue = `adminSession=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieValue);
  res.json({ success: true });
});

/**
 * GET /api/admin/feedback-stats
 * Returns feedback statistics for authenticated admin users only
 */
router.get('/admin/feedback-stats', async (req, res) => {
  if (!isAdminAuthenticated(req, res)) {
    return;
  }

  try {
    const { data: allRows, error: countError } = await supabase
      .from('video_feedback')
      .select('rating_value', { count: 'exact' });

    if (countError) {
      console.error('Supabase stats count error:', countError);
      return res.status(500).json({ success: false, error: 'Failed to load feedback stats' });
    }

    const breakdown = { '1': 0, '2': 0, '3': 0 };
    allRows.forEach((row) => {
      const rating = row.rating_value;
      if ([1, 2, 3].includes(rating)) {
        breakdown[rating] += 1;
      }
    });

    const { data: recentFeedback, error: recentError } = await supabase
      .from('video_feedback')
      .select('video_id, rating_value, comment, search_query, user_ip, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Supabase recent feedback error:', recentError);
      return res.status(500).json({ success: false, error: 'Failed to load recent feedback' });
    }

    res.json({
      success: true,
      totalFeedback: allRows.length,
      breakdown,
      recentFeedback,
    });
  } catch (error) {
    console.error('Feedback stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/stats
 * Returns feedback statistics from Supabase
 */
router.get('/feedback/stats', async (req, res) => {
  if (!authorizeFeedbackStats(req, res)) {
    return;
  }

  try {
    const { data: allRows, error: countError } = await supabase
      .from('video_feedback')
      .select('rating_value', { count: 'exact' });

    if (countError) {
      console.error('Supabase stats count error:', countError);
      return res.status(500).json({ success: false, error: 'Failed to load feedback stats' });
    }

    const breakdown = { '1': 0, '2': 0, '3': 0 };
    allRows.forEach((row) => {
      const rating = row.rating_value;
      if ([1, 2, 3].includes(rating)) {
        breakdown[rating] += 1;
      }
    });

    const { data: recentFeedback, error: recentError } = await supabase
      .from('video_feedback')
      .select('video_id, rating_value, comment, search_query, user_ip, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Supabase recent feedback error:', recentError);
      return res.status(500).json({ success: false, error: 'Failed to load recent feedback' });
    }

    res.json({
      success: true,
      totalFeedback: allRows.length,
      breakdown,
      recentFeedback,
    });
  } catch (error) {
    console.error('Feedback stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;