// netlify/functions/search.js
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SUPPORTED_LANGUAGES = ['en', 'hi'];
const PREFERRED_CAPTION_LANGUAGES = ['en', 'en-US', 'hi', 'hi-IN'];
const TELUGU_REGEX = /[\u0C00-\u0C63]/;
const MALAYALAM_REGEX = /[\u0D00-\u0D63]/;
const TAMIL_REGEX = /[\u0B80-\u0BFF]/;
const HINDI_REGEX = /[\u0900-\u097F]/;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize Gemini AI
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// Environment variables with defaults
const MIN_VIEWS = parseInt(process.env.MIN_VIEWS) || 100;
const MIN_LIKES = parseInt(process.env.MIN_LIKES) || 5;
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS) || 730;
const CACHE_DURATION_DAYS = parseInt(process.env.CACHE_DURATION_DAYS) || 7;

/**
 * Calculates the engagement ratio (likes / views).
 */
function getEngagementRatio(likes, views) {
  if (views === 0) return 0;
  return Math.min(likes / views, 1);
}

/**
 * Calculates the recency factor based on days since publication.
 */
function getRecencyFactor(publishedAt) {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const yearsSince = (now - publishDate) / (1000 * 60 * 60 * 24 * 365);

  if (yearsSince <= 1) return 1.0;
  if (yearsSince <= 2) return 0.9;
  if (yearsSince <= 4) return 0.7;
  return 0.5;
}

/**
 * Computes a view-count boost for popular videos.
 * - 1.0 for 1M+ views, 0.5 for 500K, etc.
 * - If older than 2 years, the boost is halved.
 * @param {number} viewCount - Total views for the video
 * @param {string} publishedAt - ISO 8601 publish date
 * @returns {number} Boost factor (0 to 1)
 */
function getViewBoost(viewCount, publishedAt) {
  const viewsInMillions = (viewCount || 0) / 1_000_000;
  let boost = Math.min(1.0, viewsInMillions);
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const yearsSincePublished = (now - publishDate) / (1000 * 60 * 60 * 24 * 365);

  if (yearsSincePublished > 2) {
    boost *= 0.5;
  }

  return parseFloat(boost.toFixed(4));
}

/**
 * Converts ISO 8601 duration string to total seconds
 * @param {string} duration - ISO 8601 duration string (e.g., PT1H2M30S)
 * @returns {number} Total duration in seconds
 */
function getDurationInSeconds(duration) {
  if (!duration) return 0;

  // Parse ISO 8601 duration (PT1H2M30S = 1 hour 2 minutes 30 seconds)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Checks if a video is a YouTube Short based on duration
 * @param {string} duration - ISO 8601 duration string (e.g., PT1M, PT45S)
 * @returns {boolean} True if duration <= 60 seconds
 */
function isShort(duration) {
  const totalSeconds = getDurationInSeconds(duration);
  return totalSeconds <= 60;
}

/**
 * Checks if video meets minimum duration requirement (5 minutes)
 * @param {string} duration - ISO 8601 duration string
 * @returns {boolean} True if duration >= 300 seconds (5 minutes)
 */
function meetsMinimumDuration(duration) {
  const totalSeconds = getDurationInSeconds(duration);
  return totalSeconds >= 300;
}

/**
 * Checks if video passes quality filters.
 */
function passesQualityFilter(video, publishedAt) {
  const viewCount = parseInt(video.statistics.viewCount) || 0;
  const likeCount = parseInt(video.statistics.likeCount) || 0;
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const daysSincePublished = Math.floor((now - publishDate) / (1000 * 60 * 60 * 24));
  const engagementRatio = getEngagementRatio(likeCount, viewCount);
  const duration = video.contentDetails?.duration;

  // Exclude YouTube Shorts
  if (isShort(duration)) {
    return false;
  }

  // Exclude videos shorter than 5 minutes
  if (!meetsMinimumDuration(duration)) {
    return false;
  }

  // Basic filters
  if (viewCount < MIN_VIEWS || likeCount < MIN_LIKES) {
    return false;
  }

  // Age filter with exception for high engagement
  if (daysSincePublished > MAX_AGE_DAYS && engagementRatio < 0.05) {
    return false;
  }

  return true;
}

/**
 * Fetches transcript/captions for a video.
 */
async function fetchTranscript(videoId, apiKey) {
  try {
    // Get caption tracks
    const captionResponse = await axios.get(`${YOUTUBE_API_BASE}/captions`, {
      params: {
        part: 'snippet',
        videoId: videoId,
        key: apiKey,
      },
    });

    if (!captionResponse.data.items || captionResponse.data.items.length === 0) {
      return null; // No captions available
    }

    const captionTrack = captionResponse.data.items.find(track =>
      PREFERRED_CAPTION_LANGUAGES.includes(track.snippet.language)
    );

    if (!captionTrack) {
      return null; // No preferred captions available
    }

    // Fetch the actual caption text
    const trackResponse = await axios.get(captionTrack.snippet.url, {
      params: {
        fmt: 1, // Plain text format
      },
    });

    return {
      transcript: trackResponse.data,
      language: normalizeLangCode(captionTrack.snippet.language),
    };
  } catch (error) {
    console.warn(`Failed to fetch transcript for video ${videoId}:`, error.message);
    return null;
  }
}

function normalizeLangCode(lang = '') {
  const code = lang.toLowerCase();
  if (code.startsWith('hi') || code === 'hi_IN') return 'hi';
  if (code.startsWith('en') || code === 'en_US' || code === 'en_GB') return 'en';
  if (code.startsWith('te')) return 'te';
  if (code.startsWith('ml')) return 'ml';
  if (code.startsWith('ta')) return 'ta';
  if (code.startsWith('kn')) return 'kn';
  return code.split('-')[0] || code;
}

function detectVideoLanguage(video, transcriptData) {
  const snippet = video.snippet || {};
  const fullText = `${snippet.title || ''} ${snippet.description || ''} ${snippet.channelTitle || ''}`.toLowerCase();

  // 1. Reject based on language keywords in text
  const rejectKeywords = ['telugu', 'tamil', 'malayalam', 'kannada', 'telugulo', 'తెలుగు'];
  if (rejectKeywords.some(keyword => fullText.includes(keyword))) {
    return null;
  }

  // 2. Check transcript language if available
  if (transcriptData && transcriptData.language) {
    const lang = transcriptData.language;
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      return lang;
    } else {
      return null;
    }
  }

  // 3. Check YouTube language codes
  const rawLang = (snippet.defaultAudioLanguage || snippet.defaultLanguage || '').toLowerCase();
  
  if (rawLang.startsWith('hi') || rawLang === 'hi_IN') return 'hi';
  if (rawLang.startsWith('en') || rawLang === 'en_US' || rawLang === 'en_GB') return 'en';
  
  // Reject other Indian languages
  if (rawLang.startsWith('te') || rawLang.startsWith('ml') || rawLang.startsWith('ta') || rawLang.startsWith('kn')) {
    return null;
  }

  // 4. Script-based detection for rejection
  if (TELUGU_REGEX.test(fullText)) {
    return null;
  }
  if (MALAYALAM_REGEX.test(fullText)) {
    return null;
  }
  if (TAMIL_REGEX.test(fullText)) {
    return null;
  }
  
  // 5. Check for Hindi script
  if (HINDI_REGEX.test(fullText)) {
    return 'hi';
  }

  // 6. Default to English
  return 'en';
}

/**
 * Evaluates transcript relevance using Gemini.
 */
async function evaluateTranscriptRelevance(query, transcript) {
  if (!genAI || !transcript) {
    return 0.5; // Neutral if no Gemini or transcript
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const truncatedTranscript = transcript.substring(0, 3000); // Limit tokens

    const prompt = `Given the search query '${query}' and the following video transcript, rate how relevant the content is to the query on a scale of 0 to 1, where 0 = completely irrelevant and 1 = perfect match. Respond with only a number between 0 and 1, no extra text.

Transcript:
${truncatedTranscript}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    const relevance = parseFloat(responseText);
    if (isNaN(relevance) || relevance < 0 || relevance > 1) {
      console.warn(`Invalid Gemini response for relevance: ${responseText}`);
      return 0.5;
    }

    return relevance;
  } catch (error) {
    console.warn('Gemini API error for transcript relevance:', error.message);
    return 0.5;
  }
}

/**
 * Calculates the new composite final score.
 */
function calculateFinalScore(engagementRatio, recencyFactor, sentimentScore, viewBoost) {
  const finalScore = (engagementRatio * 0.30) + (recencyFactor * 0.10) + (sentimentScore * 0.30) + (viewBoost * 0.30);
  return parseFloat(finalScore.toFixed(4));
}

/**
 * Checks cache for existing results.
 */
async function getCachedResults(query) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('search_cache')
      .select('results, created_at')
      .eq('query', query)
      .single();

    if (error || !data) return null;

    const cacheAge = (new Date() - new Date(data.created_at)) / (1000 * 60 * 60 * 24);
    if (cacheAge > CACHE_DURATION_DAYS) return null;

    return data.results;
  } catch (error) {
    console.warn('Cache read error:', error.message);
    return null;
  }
}

/**
 * Stores results in cache.
 */
async function cacheResults(query, results) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('search_cache')
      .upsert({
        query: query,
        results: results,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('Cache write error:', error.message);
    }
  } catch (error) {
    console.warn('Cache write error:', error.message);
  }
}

exports.handler = async (event, context) => {
  // 1. Get the search query from the URL
  const query = event.queryStringParameters.q;
  const maxResults = event.queryStringParameters.maxResults || 20;

  if (!query) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Search query (q) is required' }),
    };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('Missing YouTube API Key');
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Server configuration error' }),
    };
  }

  try {
    // Check cache first
    const cachedResults = await getCachedResults(query);
    if (cachedResults) {
      const results = cachedResults;
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, query, results: results.slice(0, maxResults), count: results.slice(0, maxResults).length }),
      };
    }

    // 2. Call the YouTube Search API
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        order: 'relevance',
        maxResults: Math.min(maxResults * 4, 50), // Fetch many more for filtering
        key: apiKey,
      },
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, query, results: [], count: 0 }),
      };
    }

    const videoIds = searchResponse.data.items.map(item => item.id.videoId);

    // 3. Call the YouTube Videos API to get statistics
    const statsResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(','),
        key: apiKey,
      },
    });

    // 4. Apply quality filters
    let filteredVideos = statsResponse.data.items.filter(video =>
      passesQualityFilter(video, video.snippet.publishedAt)
    );

    // 5. Process videos and keep only English/Hindi audio tutorials
    const results = [];
    for (const video of filteredVideos.slice(0, Math.min(maxResults * 3, filteredVideos.length))) {
      const transcriptData = await fetchTranscript(video.id, apiKey);
      const videoLanguage = detectVideoLanguage(video, transcriptData);

      if (!videoLanguage || !SUPPORTED_LANGUAGES.includes(videoLanguage)) {
        continue;
      }

    const viewCount = parseInt(video.statistics.viewCount) || 0;
    const likeCount = parseInt(video.statistics.likeCount) || 0;
    const engagementRatio = getEngagementRatio(likeCount, viewCount);
    const recencyFactor = getRecencyFactor(video.snippet.publishedAt);
    const sentimentScore = 0.5; // Placeholder for now

    const transcript = transcriptData?.transcript || '';

    // Evaluate transcript relevance if transcript is available
    let transcriptRelevanceScore = 0.5;

      const viewBoost = getViewBoost(viewCount, video.snippet.publishedAt);
      const finalScore = calculateFinalScore(engagementRatio, recencyFactor, sentimentScore, viewBoost);

      results.push({
        videoId: video.id,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.medium.url,
        viewCount: viewCount,
        likeCount: likeCount,
        engagementRatio: engagementRatio,
        viewBoost: viewBoost,
        finalScore: finalScore,
        transcriptRelevanceScore: transcriptRelevanceScore,
        language: videoLanguage,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        publishedAt: video.snippet.publishedAt,
      });
    }

    // Sort by finalScore descending
    results.sort((a, b) => b.finalScore - a.finalScore);

    // Cache the results
    await cacheResults(query, results);

    // Return top results
    const finalResults = results.slice(0, maxResults);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, query, results: finalResults, count: finalResults.length }),
    };
  } catch (error) {
    console.error('YouTube API error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to search YouTube' }),
    };
  }
};