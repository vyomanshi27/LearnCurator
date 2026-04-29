/**
 * YouTube Service
 * Handles all YouTube API calls and video scoring logic
 */

const axios = require('axios');
const Sentiment = require('sentiment');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const sentiment = new Sentiment();
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SUPPORTED_LANGUAGES = ['en', 'hi'];
const HINDI_REGEX = /[\u0900-\u097F]/;
const TELUGU_REGEX = /[\u0C00-\u0C63]/;
const MALAYALAM_REGEX = /[\u0D00-\u0D63]/;

// Initialize Gemini AI (if API key is available)
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Calculates the recency factor based on days since publication
 * - 1.0 for videos published in the last 30 days
 * - 0.5 for videos published 30-90 days ago
 * - 0.2 for videos older than 90 days
 * @param {string} publishedAt - ISO 8601 formatted date string
 * @returns {number} Recency factor (0.2 to 1.0)
 */
function getRecencyFactor(publishedAt) {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const daysSincePublished = Math.floor((now - publishDate) / (1000 * 60 * 60 * 24));

  if (daysSincePublished <= 30) {
    return 1.0;
  } else if (daysSincePublished <= 90) {
    return 0.5;
  } else {
    return 0.2;
  }
}

/**
 * Calculates the engagement ratio (likes / views)
 * Handles division by zero
 * @param {number} likes - Like count
 * @param {number} views - View count
 * @returns {number} Engagement ratio (0 to 1)
 */
function getEngagementRatio(likes, views) {
  if (views === 0) {
    return 0;
  }
  return Math.min(likes / views, 1); // Cap at 1.0
}

/**
 * Calculates the custom engagement score
 * score = (engagementRatio * 0.7) + (recencyFactor * 0.3)
 * @param {object} video - Video object with likeCount, viewCount, publishedAt
 * @returns {number} Score (0 to 1)
 */
function calculateScore(video) {
  const engagementRatio = getEngagementRatio(
    parseInt(video.likeCount) || 0,
    parseInt(video.viewCount) || 0
  );
  const recencyFactor = getRecencyFactor(video.publishedAt);

  const score = engagementRatio * 0.7 + recencyFactor * 0.3;
  return parseFloat(score.toFixed(4)); // Round to 4 decimal places
}

/**
 * Checks if a video is a YouTube Short based on duration
 * @param {string} duration - ISO 8601 duration string (e.g., PT1M, PT45S)
 * @returns {boolean} True if duration <= 60 seconds
 */
function isShort(duration) {
  if (!duration) return false;

  // Parse ISO 8601 duration (PT1M30S = 1 minute 30 seconds)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds <= 60;
}

/**
 * Transforms raw video data from YouTube API into our app format
 * @param {object} item - YouTube search result item
 * @param {object} videoDetails - Statistics and snippet from YouTube API
 * @returns {object} Formatted video object
 */
function formatVideoData(item, videoDetails) {
  const snippet = videoDetails.snippet;
  const statistics = videoDetails.statistics;
  const contentDetails = videoDetails.contentDetails;

  const video = {
    videoId: item.id.videoId,
    title: snippet.title,
    description: snippet.description,
    channelTitle: snippet.channelTitle,
    channelId: snippet.channelId,
    thumbnail: snippet.thumbnails.medium.url,
    viewCount: parseInt(statistics.viewCount) || 0,
    likeCount: parseInt(statistics.likeCount) || 0,
    commentCount: parseInt(statistics.commentCount) || 0,
    publishedAt: snippet.publishedAt,
    duration: contentDetails.duration,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  };

  // Calculate engagement metrics
  video.engagementRatio = getEngagementRatio(video.likeCount, video.viewCount);
  video.score = calculateScore(video);

  return video;
}

function detectVideoLanguage(videoDetails, title, description) {
  const snippet = videoDetails.snippet || {};
  const rawLang = (snippet.defaultAudioLanguage || snippet.defaultLanguage || '').toLowerCase();
  const fullText = `${title || ''} ${description || ''} ${snippet.channelTitle || ''}`.toLowerCase();

  // Reject based on language keywords in text
  const rejectKeywords = ['telugu', 'tamil', 'malayalam', 'kannada', 'telugulo', 'తెలుగు'];
  if (rejectKeywords.some(keyword => fullText.includes(keyword))) {
    return null;
  }

  // Check for Hindi
  if (rawLang.startsWith('hi') || rawLang === 'hi_IN') return 'hi';
  
  // Check for English
  if (rawLang.startsWith('en') || rawLang === 'en_US' || rawLang === 'en_GB') return 'en';

  // Reject Telugu
  if (rawLang.startsWith('te')) return null;
  
  // Reject Malayalam
  if (rawLang.startsWith('ml')) return null;

  // Reject Tamil
  if (rawLang.startsWith('ta')) return null;

  // Reject Kannada
  if (rawLang.startsWith('kn')) return null;

  const text = `${title || ''} ${description || ''}`;
  
  // Reject based on script detection
  if (TELUGU_REGEX.test(text)) return null;
  if (MALAYALAM_REGEX.test(text)) return null;
  
  if (HINDI_REGEX.test(text)) {
    return 'hi';
  }

  return 'en';
}

/**
 * Fetches comments for a video using YouTube API
 * @param {string} videoId - YouTube video ID
 * @param {string} apiKey - YouTube API key
 * @param {number} maxResults - Maximum number of comments to fetch (default: 50)
 * @returns {Promise<Array<string>>} Array of comment texts
 */
async function fetchVideoComments(videoId, apiKey, maxResults = 50) {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/commentThreads`, {
      params: {
        part: 'snippet',
        videoId: videoId,
        maxResults: Math.min(maxResults, 100), // YouTube API limit
        order: 'relevance',
        key: apiKey,
      },
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map((item) => item.snippet.topLevelComment.snippet.textDisplay);
  } catch (error) {
    // Handle quota exceeded or comments disabled
    if (error.response?.status === 403 || error.response?.status === 400) {
      console.warn(`Comments not available for video ${videoId}: ${error.response?.data?.error?.message || error.message}`);
      return [];
    }
    console.error(`Error fetching comments for video ${videoId}:`, error.message);
    return [];
  }
}

/**
 * Analyzes sentiment using Google Gemini AI
 * Batches comments for efficient API calls
 * @param {Array<string>} comments - Array of comment texts
 * @returns {Promise<number>} Sentiment score (0 to 1, where 1 is most positive)
 */
async function analyzeSentimentWithGemini(comments) {
  if (!genAI || !comments || comments.length === 0) {
    return 0.5; // Neutral score when no Gemini or no comments
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Sample comments for analysis (limit to 20 to save API quota)
    const sampleComments = comments.slice(0, Math.min(20, comments.length));
    const commentsText = sampleComments.map((c, i) => `${i + 1}. ${c}`).join('\n');

    const prompt = `Analyze the following YouTube comments and determine the overall sentiment. Count how many are positive, negative, or neutral.

Comments:
${commentsText}

Respond with ONLY a JSON object in this format:
{"positive": <number>, "negative": <number>, "neutral": <number>}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[^}]*\}/);
    if (!jsonMatch) {
      console.warn('Invalid Gemini response format, falling back to basic sentiment');
      return calculateSentimentScoreFallback(comments);
    }

    const sentimentData = JSON.parse(jsonMatch[0]);
    const total = sentimentData.positive + sentimentData.negative + sentimentData.neutral;

    if (total === 0) {
      return 0.5; // Neutral if no sentiment detected
    }

    // Return positive ratio normalized to 0-1 scale
    const positiveRatio = sentimentData.positive / total;
    return parseFloat(positiveRatio.toFixed(4));
  } catch (error) {
    console.error('Gemini API error, falling back to basic sentiment:', error.message);
    return calculateSentimentScoreFallback(comments);
  }
}

/**
 * Fallback sentiment analysis using the basic sentiment library
 * @param {Array<string>} comments - Array of comment texts
 * @returns {number} Sentiment score (0 to 1, where 1 is most positive)
 */
function calculateSentimentScoreFallback(comments) {
  if (!comments || comments.length === 0) {
    return 0.5; // Neutral score when no comments
  }

  let positiveCount = 0;
  let negativeCount = 0;

  comments.forEach((comment) => {
    const result = sentiment.analyze(comment);
    if (result.score > 0) {
      positiveCount++;
    } else if (result.score < 0) {
      negativeCount++;
    }
  });

  const total = positiveCount + negativeCount + (comments.length - positiveCount - negativeCount);
  return positiveCount / total;
}

/**
 * Calculates sentiment score from comments using Gemini with fallback
 * @param {Array<string>} comments - Array of comment texts
 * @returns {Promise<number>} Sentiment score (0 to 1, where 1 is most positive)
 */
async function calculateSentimentScore(comments) {
  if (!comments || comments.length === 0) {
    return 0.5; // Neutral score when no comments
  }

  // Try Gemini AI first if available, otherwise use fallback
  if (genAI) {
    return await analyzeSentimentWithGemini(comments);
  } else {
    return calculateSentimentScoreFallback(comments);
  }
}

/**
 * Calculates final score with sentiment
 * finalScore = (engagementRatio * 0.4) + (recencyFactor * 0.2) + (sentimentScore * 0.4)
 * @param {object} video - Video object with engagementRatio, publishedAt, sentimentScore
 * @returns {number} Final score (0 to 1)
 */
function calculateFinalScore(video) {
  const engagementRatio = video.engagementRatio;
  const recencyFactor = getRecencyFactor(video.publishedAt);
  const sentimentScore = video.sentimentScore || 0.5; // Default to neutral

  const finalScore = engagementRatio * 0.4 + recencyFactor * 0.2 + sentimentScore * 0.4;
  return parseFloat(finalScore.toFixed(4));
}

/**
 * Fetches video statistics from YouTube API
 * @param {Array<string>} videoIds - Array of video IDs
 * @param {string} apiKey - YouTube API key
 * @returns {Promise<object>} Map of video ID to full video details
 */
async function fetchVideoStatistics(videoIds, apiKey) {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(','),
        key: apiKey,
      },
    });

    const videoMap = {};
    response.data.items.forEach((item) => {
      videoMap[item.id] = item;
    });

    return videoMap;
  } catch (error) {
    console.error('Error fetching video statistics:', error.message);
    throw new Error('Failed to fetch video statistics from YouTube API');
  }
}

/**
 * Searches YouTube for videos matching a query
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results (default: 20)
 * @param {object} options - Additional options
 * @returns {Promise<Array>} Array of formatted video objects sorted by score
 */
async function searchVideos(query, maxResults = 20, options = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YouTube API key not configured. Set YOUTUBE_API_KEY in .env');
  }

  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  try {
    // Step 1: Search for videos
    const searchParams = {
      part: 'snippet',
      q: query,
      type: 'video',
      order: 'relevance',
      maxResults: Math.min(maxResults * 2, 50), // Fetch more to account for filtering shorts
      key: apiKey,
    };


    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: searchParams,
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    // Extract video IDs from search results
    const videoIds = searchResponse.data.items.map((item) => item.id.videoId);

    // Step 2: Fetch detailed statistics for all videos
    const videoDetails = await fetchVideoStatistics(videoIds, apiKey);

    // Step 3: Format videos and filter out shorts
    let videos = searchResponse.data.items
      .map((item) => {
        if (videoDetails[item.id.videoId]) {
          return formatVideoData(item, videoDetails[item.id.videoId]);
        }
        return null;
      })
      .filter((video) => video !== null && !isShort(video.duration));

    // Step 3.5: Keep only English/Hindi videos
    videos = videos.filter((video) => {
      const detectedLang = detectVideoLanguage(
        videoDetails[video.videoId],
        video.title,
        video.description
      );
      video.detectedLanguage = detectedLang;
      return detectedLang !== null && SUPPORTED_LANGUAGES.includes(detectedLang);
    });

    // Step 4: Sort by initial score and take top N for sentiment analysis
    videos.sort((a, b) => b.score - a.score);
    const topVideos = videos.slice(0, Math.min(20, videos.length));

    // Step 5: Fetch comments and calculate sentiment for top videos
    for (const video of topVideos) {
      try {
        const comments = await fetchVideoComments(video.videoId, apiKey);
        video.sentimentScore = await calculateSentimentScore(comments);
        video.finalScore = calculateFinalScore(video);
      } catch (error) {
        console.warn(`Failed to get sentiment for video ${video.videoId}:`, error.message);
        video.sentimentScore = 0.5; // Neutral
        video.finalScore = calculateFinalScore(video);
      }
    }

    // Step 6: Sort by final score (descending)
    videos.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));

    // Return only the requested number of results
    return videos.slice(0, maxResults);
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error(
        'YouTube API quota exceeded or invalid API key. Check your YOUTUBE_API_KEY.'
      );
    } else if (error.response?.status === 401) {
      throw new Error('Invalid YouTube API key. Check your YOUTUBE_API_KEY.');
    } else if (error.message.includes('YouTube API')) {
      throw error;
    } else {
      console.error('YouTube API error:', error.message);
      throw new Error('Failed to search YouTube');
    }
  }
}

module.exports = {
  searchVideos,
  calculateScore,
  getEngagementRatio,
  getRecencyFactor,
  calculateFinalScore,
  isShort,
};
