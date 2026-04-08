# LearnCurator - YouTube Tutorial Finder

A web application that helps students find the best YouTube tutorials by sorting videos based on engagement (likes/views ratio) and recency, not just views.

## 🎯 Features

- **Smart Search**: Search for tutorials on any topic
- **Custom Engagement Score**: Videos sorted by a custom formula that considers:
  - **Engagement Ratio** (70%): Likes divided by views, indicating quality
  - **Recency Factor** (30%): How recently the video was published
- **Clean UI**: Modern, responsive design that works on all devices
- **Video Metrics**: Display views, likes, engagement ratio, and publication date
- **Direct Links**: One-click access to YouTube videos
- **Error Handling**: Graceful error messages and loading states

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
- Deployed on: Koyeb

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

### Engagement Ratio
- Calculated as: `likes / views`
- Indicates **content quality**
- Higher ratio means viewers liked the content
- Weight in score: **70%**

### Recency Factor
- Based on how many days ago the video was published:
  - **1.0** (100%) - Published in last 30 days (fresh content)
  - **0.5** (50%) - Published 30-90 days ago
  - **0.2** (20%) - Published more than 90 days ago
- Ensures you get **recent, relevant tutorials**
- Weight in score: **30%**

### Final Score
```
score = (engagementRatio × 0.7) + (recencyFactor × 0.3)
```

Videos are sorted by score in **descending order**.

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

## 📦 Deployment

### Frontend (Netlify)

1. **Push your frontend code to GitHub**
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to https://netlify.com/
   - Click "New site from Git"
   - Select your GitHub repository
   - Build command: (leave empty for static site)
   - Publish directory: `frontend` or `.`

3. **Update API URL**
   - In [frontend/script.js](frontend/script.js), update `API_BASE_URL` to your deployed backend URL

4. **Redeploy** to apply changes

### Backend (Render)

1. **Push your backend code to GitHub**
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Render**
   - Go to https://render.com/
   - Click "New +" → "Web Service"
   - Select your GitHub repository
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables from `.env`

3. **Note the deployed URL** (e.g., `https://learncurator-api.onrender.com`)

4. **Update frontend API URL** with the deployed backend URL

### Backend (Railway)

1. **Deploy with Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   cd backend
   railway init
   railway up
   ```

2. **Add environment variables** in Railway dashboard

3. **Get the URL** from Railway dashboard and update frontend

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
