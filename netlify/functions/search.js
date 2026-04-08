// netlify/functions/search.js
const axios = require('axios');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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
  const daysSincePublished = Math.floor((now - publishDate) / (1000 * 60 * 60 * 24));

  if (daysSincePublished <= 30) return 1.0;
  if (daysSincePublished <= 90) return 0.5;
  return 0.2;
}

/**
 * Calculates the custom engagement score.
 */
function calculateScore(engagementRatio, recencyFactor) {
  const score = engagementRatio * 0.7 + recencyFactor * 0.3;
  return parseFloat(score.toFixed(4));
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
    // 2. Call the YouTube Search API
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        order: 'relevance',
        maxResults: maxResults,
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
        part: 'snippet,statistics',
        id: videoIds.join(','),
        key: apiKey,
      },
    });

    // 4. Combine the data and format the results
    const results = statsResponse.data.items.map(video => {
      const viewCount = parseInt(video.statistics.viewCount) || 0;
      const likeCount = parseInt(video.statistics.likeCount) || 0;
      const engagementRatio = getEngagementRatio(likeCount, viewCount);
      const recencyFactor = getRecencyFactor(video.snippet.publishedAt);
      const score = calculateScore(engagementRatio, recencyFactor);

      return {
        videoId: video.id,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.medium.url,
        viewCount: viewCount,
        likeCount: likeCount,
        engagementRatio: engagementRatio,
        score: score,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        publishedAt: video.snippet.publishedAt,
      };
    });

    // Sort results by score (highest first)
    results.sort((a, b) => b.score - a.score);

    // 5. Send the successful response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, query, results, count: results.length }),
    };
  } catch (error) {
    console.error('YouTube API error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to search YouTube' }),
    };
  }
};