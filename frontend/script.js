/**
 * LearnCurator Frontend
 * Main JavaScript application logic
 */

// Configuration
const CONFIG = {
  API_BASE_URL: '/.netlify/functions/search', // Default local backend URL for development.
  DEFAULT_MAX_RESULTS: 20,
};

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const errorClose = document.querySelector('.error-close');
const resultsSection = document.getElementById('resultsSection');
const resultsTitle = document.getElementById('resultsTitle');
const resultsInfo = document.getElementById('resultsInfo');
const videosGrid = document.getElementById('videosGrid');
const noResults = document.getElementById('noResults');
const emptyState = document.getElementById('emptyState');

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', function () {
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
  errorClose.addEventListener('click', hideError);
});

/**
 * Format large numbers to readable format (K, M, B)
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format engagement ratio as percentage
 * @param {number} ratio - Ratio value (0-1)
 * @returns {string} Formatted percentage
 */
function formatEngagementRatio(ratio) {
  return (ratio * 100).toFixed(2) + '%';
}

/**
 * Format date to relative time (e.g., "2 days ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      return 'Just now';
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  } else {
    const months = Math.floor(diffDays / 30);
    if (months < 12) {
      return `${months}mo ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years}y ago`;
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.remove('hidden');

  // Auto-hide after 6 seconds
  setTimeout(hideError, 6000);
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.classList.add('hidden');
}

/**
 * Show loading spinner
 */
function showLoadingSpinner() {
  loadingSpinner.classList.remove('hidden');
}

/**
 * Hide loading spinner
 */
function hideLoadingSpinner() {
  loadingSpinner.classList.add('hidden');
}

/**
 * Show results section
 */
function showResultsSection() {
  resultsSection.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

/**
 * Hide results section
 */
function hideResultsSection() {
  resultsSection.classList.add('hidden');
}

/**
 * Show empty state
 */
function showEmptyState() {
  emptyState.classList.remove('hidden');
  hideResultsSection();
}

function hideEmptyState() {
  emptyState.classList.add('hidden');
}

/**
 * Render a single video card
 * @param {object} video - Video object from API
 * @returns {HTMLElement} Video card element
 */
function createVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.innerHTML = `
    <div class="video-thumbnail">
      <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" />
      <div class="score-badge">
        <span>Score: ${(video.score * 100).toFixed(1)}</span>
      </div>
    </div>
    <div class="video-content">
      <h3 class="video-title">${escapeHtml(video.title)}</h3>
      <p class="video-channel">${escapeHtml(video.channelTitle)}</p>
      <div class="video-stats">
        <div class="stat">
          <span class="stat-label">Views</span>
          <span class="stat-value">${formatNumber(video.viewCount)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Likes</span>
          <span class="stat-value">${formatNumber(video.likeCount)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Engagement</span>
          <span class="stat-value">${formatEngagementRatio(video.engagementRatio)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Posted</span>
          <span class="stat-value">${formatRelativeTime(video.publishedAt)}</span>
        </div>
      </div>
      <a href="${video.url}" target="_blank" rel="noopener noreferrer" class="watch-link">
        Watch on YouTube →
      </a>
    </div>
  `;
  return card;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Render videos to the grid
 * @param {Array} videos - Array of video objects
 */
function renderVideos(videos) {
  videosGrid.innerHTML = '';

  if (videos.length === 0) {
    noResults.classList.remove('hidden');
    hideEmptyState();
    hideLoadingSpinner();
    return;
  }

  noResults.classList.add('hidden');

  videos.forEach((video) => {
    const card = createVideoCard(video);
    videosGrid.appendChild(card);
  });

  hideLoadingSpinner();

  // Scroll results into view
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Perform search query
 */
async function performSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    showError('Please enter a search query');
    return;
  }

  // Disable search button and show loading
  searchBtn.disabled = true;
  hideError();
  hideEmptyState();
  noResults.classList.add('hidden');
  showLoadingSpinner();
  hideResultsSection();

  try {
    // Build API URL
    const apiBaseUrl = getApiBaseUrl();
    const apiUrl = `${apiBaseUrl}?q=${encodeURIComponent(query)}&maxResults=${CONFIG.DEFAULT_MAX_RESULTS}`;

    console.log('Searching backend with URL:', apiUrl);

    // Fetch from API
    const response = await fetch(apiUrl);

    // Handle HTTP errors
    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.clone().json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        const text = await response.clone().text();
        if (text) {
          errorMessage = text.trim().slice(0, 200);
        }
      }

      throw new Error(errorMessage);
    }

    // Parse response
    let data;
    try {
      data = await response.clone().json();
    } catch (parseError) {
      const invalidBody = await response.clone().text();
      throw new Error(
        `Invalid JSON response from server. Received: ${invalidBody
          .trim()
          .slice(0, 200)}`
      );
    }

    if (!data.success) {
      throw new Error(data.error || 'Unknown error occurred');
    }

    // Update results UI
    resultsTitle.textContent = `Results for "${query}"`;
    resultsInfo.textContent = `Found ${data.count} tutorial${data.count !== 1 ? 's' : ''}`;

    // Show results section
    showResultsSection();

    // Render videos
    renderVideos(data.results);
  } catch (error) {
    hideLoadingSpinner();
    const errorMsg = error.message || 'An error occurred while searching';
    showError(errorMsg);
    console.error('Search error:', error);
  } finally {
    searchBtn.disabled = false;
  }
}

function getApiBaseUrl() {
  if (CONFIG.API_BASE_URL && CONFIG.API_BASE_URL !== 'https://your-backend-url.com') {
    return CONFIG.API_BASE_URL;
  }

  if (window.location.protocol === 'file:') {
    return 'http://localhost:5000';
  }

  return window.location.origin;
}

function loadConfiguration() {
  if (!CONFIG.API_BASE_URL || CONFIG.API_BASE_URL === 'https://your-backend-url.com') {
    CONFIG.API_BASE_URL = getApiBaseUrl();
  }

  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log('Running in production mode');
  }
}

// Initialize configuration on page load
window.addEventListener('load', loadConfiguration);

console.log('✓ LearnCurator Frontend initialized');
