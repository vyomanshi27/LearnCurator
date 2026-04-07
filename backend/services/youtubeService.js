/**
 * YouTube Service
 * Handles all YouTube API calls and video scoring logic
 */

const axios = require('axios');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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
 * Transforms raw video data from YouTube API into our app format
 * @param {object} item - YouTube search result item
 * @param {object} videoDetails - Statistics and snippet from YouTube API
 * @returns {object} Formatted video object
 */
function formatVideoData(item, videoDetails) {
  const snippet = videoDetails.snippet;
  const statistics = videoDetails.statistics;

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
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  };

  // Calculate engagement metrics
  video.engagementRatio = getEngagementRatio(video.likeCount, video.viewCount);
  video.score = calculateScore(video);

  return video;
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
        part: 'snippet,statistics',
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
 * @returns {Promise<Array>} Array of formatted video objects sorted by score
 */
async function searchVideos(query, maxResults = 20) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YouTube API key not configured. Set YOUTUBE_API_KEY in .env');
  }

  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  try {
    // Step 1: Search for videos
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        order: 'relevance',
        maxResults: Math.min(maxResults, 50), // YouTube API limit
        key: apiKey,
      },
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    // Extract video IDs from search results
    const videoIds = searchResponse.data.items.map((item) => item.id.videoId);

    // Step 2: Fetch detailed statistics for all videos
    const videoDetails = await fetchVideoStatistics(videoIds, apiKey);

    // Step 3: Format and score each video
    const videos = searchResponse.data.items
      .map((item) => {
        if (videoDetails[item.id.videoId]) {
          return formatVideoData(item, videoDetails[item.id.videoId]);
        }
        return null;
      })
      .filter((video) => video !== null);

    // Step 4: Sort by score (descending)
    videos.sort((a, b) => b.score - a.score);

    return videos;
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
};
