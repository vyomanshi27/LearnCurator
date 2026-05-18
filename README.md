# LearnCurator - YouTube Tutorial Finder

A web application that helps students find the best YouTube tutorials by sorting videos based on engagement (likes/views ratio) and recency, not just views.

## 🎯 Features
1. **Core user features**
 - Search YouTube tutorials by keyword
 - Sort results by a custom score, not just views
 - Show video metadata:
   title
   channel
   views
   likes
 - engagement ratio
 - relative publish date
 - Direct "Watch on YouTube" links
 - Error handling with user-friendly message

2. **Ranking / algorithm features**
 - Engagement-based ranking using likes/views ratio
 - Recency-based scoring
 - Final score calculation with:
      engagement
      recency
      sentiment (when **Gemini AI** enabled)
      view boost
 - Filtering out:
      YouTube Shorts
      videos shorter than minimum duration
      low-quality / low-engagement videos
 - Language filtering for English/Hindi content
 - Channel/language keyword blocking for non-target languages

3. **Feedback & admin features**
 - Per-video feedback widget with 3-step rating
 - Admin login endpoint and session cookie
 - Admin feedback dashboard (admin.html)
 - Feedback stats endpoint for analytics
 - Recent feedback listing

## 📋 Tech Stack

### Frontend
- HTML5
- CSS3 (with CSS Grid, Flexbox)
- Vanilla JavaScript (ES6+)
- Deployed on: Netlify

### Backend
- Node.js
- Express.js
- YouTube Data API v3
- Deployed on: Netlify
- Gemini API Key

## 🚀 Getting Started

### Prerequisites

- Node.js 14+ and npm
- YouTube Data API key (see [Get YouTube API Key](#get-youtube-api-key))

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file** (copy from `.env.example`)
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` and add your YouTube API key**
   ```env
   YOUTUBE_API_KEY=your_actual_youtube_api_key
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

5. **Start backend server**
   ```bash
   npm start
   ```
   Server runs on: `http://localhost:5000`

   For development with auto-reload:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Start a local server** (choose one method)

   **Using Python 3:**
   ```bash
   python -m http.server 3000
   ```

   **Using Python 2:**
   ```bash
   python -m SimpleHTTPServer 3000
   ```

   **Using Node.js (http-server):**
   ```bash
   npm install -g http-server
   http-server -p 3000
   ```

   **Using VS Code Live Server:**
   - Install the Live Server extension
   - Right-click `index.html` → "Open with Live Server"

3. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🔧 Configuration

### Update API URL for Production

In [frontend/script.js](frontend/script.js), update the `CONFIG` object:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://your-backend-url.com', // Your production backend URL
  DEFAULT_MAX_RESULTS: 20,
};
```

## 🎓 How the Scoring Works

1. **Initial engagement score**
The app first computes a base score for each video using:
  -engagementRatio = likes / views (capped at 1.0)
  -recencyFactor based on publish age
   
In youtubeService.js:
  -score = engagementRatio * 0.7 + recencyFactor * 0.3
  -So videos with high like/view ratio and recent publish date rank higher.

2. **Sentiment and final score**
After getting the top candidate videos, it enriches them with sentiment analysis and a popularity boost.

 -  Final score formula:
    finalScore = engagementRatio * 0.3
    + recencyFactor * 0.1
    + sentimentScore * 0.3
    + viewBoost * 0.3

## 📚 API Documentation

### Search Endpoint

**Endpoint:**
```
GET /api/search?q=query&maxResults=20
```

**Query Parameters:**
- `q` (required): Search query (e.g., "Python async programming")
- `maxResults` (optional): Maximum results to return (1-50, default: 20)

**Response Example:**
```json
{
  "success": true,
  "query": "html for beginners",
  "results": [
    {
      "videoId": "abc123def456",
      "title": "HTML Basics Full Course",
      "channelTitle": "freeCodeCamp",
      "viewCount": 500000,
      "likeCount": 15000,
      "engagementRatio": 0.03,
      "score": 0.0309,
      "publishedAt": "2024-01-15T10:30:00Z",
      "thumbnail": "https://i.ytimg.com/...",
      "url": "https://www.youtube.com/watch?v=abc123def456"
    }
    // ... more videos sorted by score
  ],
  "count": 20,
  "timestamp": "2024-03-26T10:45:30.123Z"
}
```

## 🔐 Get YouTube API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a new project**
   - Click "Select a Project" → "NEW PROJECT"
   - Name it "LearnCurator"
   - Click "CREATE"

3. **Enable YouTube Data API v3**
   - Search for "YouTube Data API v3"
   - Click on it → Click "ENABLE"

4. **Create API Key**
   - Go to "Credentials" in the left menu
   - Click "CREATE CREDENTIALS" → "API Key"
   - Copy the key

5. **Add to `.env` file**
   ```env
   YOUTUBE_API_KEY=your_copied_api_key
   ```

**⚠️ Important Security Notes:**
- Keep your API key **private** - never commit to GitHub
- Use `.env` file and add to `.gitignore`
- Consider setting API usage quotas in Google Cloud Console



## 🛠️ Project Structure

```
LearnCurator/
├── backend/
│   ├── node_modules/          # Dependencies
│   ├── middleware/
│   │   └── errorHandler.js    # Global error handler
│   ├── routes/
│   │   └── search.js          # Search API endpoint
│   ├── services/
│   │   └── youtubeService.js  # YouTube API calls & scoring
│   ├── .env.example           # Environment variables template
│   ├── .gitignore             # Git ignore rules
│   ├── package.json           # Dependencies & scripts
│   └── server.js              # Express app entry point
│
├── frontend/
│   ├── index.html             # Main HTML file
│   ├── style.css              # Styling
│   └── script.js              # Frontend logic
│
└── README.md                  # This file
```

## 🐛 Troubleshooting

### "YouTube API key not configured"
- Ensure `.env` file exists in the backend directory
- Check that `YOUTUBE_API_KEY` is set correctly
- Restart the backend server after changing `.env`

### "API error: 403"
- YouTube Data API quota exceeded
- Check usage in Google Cloud Console
- Free tier has 10,000 queries/day by default

### "API error: 401"
- Invalid YouTube API key
- Verify key in Google Cloud Console → Credentials
- Regenerate if needed

### CORS errors in console
- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
- For local development: `http://localhost:3000`
- For production: `https://your-frontend-url.com`

### Videos not loading
- Check network tab in browser DevTools
- Verify backend is running: `http://localhost:5000/health`
- Check backend console for errors

## 📝 Code Best Practices

- **Separation of Concerns**: Frontend, backend, and API logic are separated
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Security**: Environment variables for sensitive data, CORS configuration
- **Accessibility**: Semantic HTML, ARIA labels for screen readers
- **Responsive Design**: Mobile-first approach, works on all screen sizes
- **Performance**: Lazy loading for images, efficient API calls

## 📄 License

MIT License - feel free to use for educational purposes

## 💡 Future Enhancements

- [ ] User authentication and saved favorites
- [ ] Advanced filters (duration, language, upload date range)
- [ ] Video preview on hover
- [ ] Playlist support
- [ ] Dark mode toggle
- [ ] Pagination for more results
- [ ] Search suggestions/autocomplete
- [ ] Share results via link
- [ ] Download video metadata as CSV

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report issues
- Suggest improvements
- Submit fixes

## 📞 Support

For questions or issues:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review YouTube Data API documentation: https://developers.google.com/youtube/v3
3. Check Express.js documentation: https://expressjs.com/

---

**Happy learning! 🎓**
