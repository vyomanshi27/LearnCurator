/**
 * Search Routes
 * Handles video search requests
 */

const express = require('express');
const { searchVideos } = require('../services/youtubeService');

const router = express.Router();

/**
 * GET /api/search
 * Searches for YouTube videos based on a query parameter
 *
 * Query Parameters:
 *   - q (required): Search query (e.g., "html for beginners")
 *   - maxResults (optional): Maximum number of results (default: 20, max: 50)
 *
 * Response:
 *   {
 *     success: boolean,
 *     query: string,
 *     results: Array<Video>,
 *     count: number,
 *     timestamp: string
 *   }
 *
 * Video Object:
 *   {
 *     videoId: string,
 *     title: string,
 *     channelTitle: string,
 *     thumbnail: string,
 *     viewCount: number,
 *     likeCount: number,
 *     engagementRatio: number,
 *     score: number,
 *     publishedAt: string,
 *     url: string
 *   }
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, maxResults } = req.query;

    // Validate query parameter
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    // Validate maxResults if provided
    let limit = 20;
    if (maxResults) {
      limit = Math.min(parseInt(maxResults) || 20, 50);
      if (limit < 1) limit = 1;
    }

    // Search for videos
    const results = await searchVideos(q, limit);

    // Return successful response
    res.json({
      success: true,
      query: q,
      results: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
