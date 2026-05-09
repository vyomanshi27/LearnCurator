# Google Gemini AI Integration Guide

This guide explains how to set up and use Google Generative AI (Gemini) for enhanced comment sentiment analysis in LearnCurator.

## Overview

LearnCurator now supports using Google's Gemini AI API for advanced sentiment analysis of YouTube video comments. This provides more accurate sentiment assessment compared to the basic sentiment library.

### How It Works

1. When a video is ranked in the top 20, the system fetches comments
2. **With Gemini enabled**: Comments are sent to Gemini AI for analysis
3. **Fallback mode**: If Gemini is not configured or fails, uses the basic sentiment library

**Sentiment Score Range**: 0 to 1
- 0.0 = Very negative comments
- 0.5 = Neutral/mixed comments
- 1.0 = Very positive comments

## Setup Instructions

### Step 1: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account (or create one)
3. Click **"Create API Key"** button
4. Copy the API key

### Step 2: Configure Environment Variable

Add the API key to your `.env` file in the `backend/` directory:

```env
GEMINI_API_KEY=your-api-key-here
```


```

### Step 3: Restart Backend Server

```bash
cd backend
npm start
```

## API Quota Considerations

### Gemini API Quota
- **Free tier**: 15 requests per minute, 500 requests per day
- **Paid tier**: Up to 300 requests per minute (higher with dedicated projects)

### How Many Comments Are Analyzed
- Videos are sampled from the top 20 results (to save quota)
- Up to 20 comments per video are sent to Gemini in a batch
- Total request per search: ~20 Gemini API calls (one per top video)

### Cost Estimation
- Gemini 1.5 Flash: Very affordable (typically < $0.01 per 1000 tokens)
- Typical comment analysis: ~500-1000 tokens per video
- Cost per search: ~$0.01-0.02 USD for analyzing all top videos

## Features

### Gemini Analysis

Gemini AI analyzes comments with these capabilities:

✅ **Sentiment Classification**
- Categorizes each comment as positive, negative, or neutral
- Understands context and sarcasm better than keyword-based analysis

✅ **Batch Processing**
- Efficiently analyzes multiple comments in one API call
- Reduces token usage and API costs

✅ **Intelligent Parsing**
- Extracts sentiment distribution from Gemini's response
- Calculates positive comment ratio

### Fallback System

If Gemini API is:
- **Not configured**: Uses basic sentiment library automatically
- **Rate limited**: Falls back to basic sentiment for that video
- **Having errors**: Continues with neutral score (0.5) and logs warning

## Monitoring & Debugging

### Check If Gemini Is Active

1. Look at server startup messages (would show Gemini initialization)
2. Check the console logs when searching:
   ```
   [If working]: "Gemini analyzing comments for video XYZ"
   [If fallback]: "Gemini API error, falling back to basic sentiment"
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| `GEMINI_API_KEY` not found | Add it to `.env` file and restart server |
| 403 Forbidden error | Check API key is correct and enabled |
| 429 Rate Limited | You've exceeded quota; wait before next request |
| Invalid JSON response | Gemini format changed; will fall back to basic sentiment |

## Advanced Configuration

### Customize Sampling

Edit `youtubeService.js` to change how many comments are analyzed:

```javascript
// Line ~160: Change sample size
const sampleComments = comments.slice(0, Math.min(20, comments.length));
// Change 20 to 10 to analyze fewer comments (saves quota)
```

### Use Different Gemini Models

Edit the model selection in `youtubeService.js`:

```javascript
// Current: gemini-1.5-flash (cheapest, fastest)
// Other options:
// - gemini-1.5-pro (more accurate but more expensive)
// - gemini-2.0-flash (newer version if available)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
```

## Testing

### Test Gemini Connection

Run this Node.js script in the backend directory:

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

(async () => {
  const result = await model.generateContent('Say "Gemini is working!"');
  console.log(result.response.text());
})();
```

### Test Sentiment Analysis

Add this logging to see sentiment analysis happening:

```javascript
// In calculateSentimentScore function
console.log(`Analyzing ${comments.length} comments using Gemini...`);
// And after Gemini returns:
console.log(`Sentiment score: ${sentimentScore}`);
```

## Scoring Formula

The final score combines:

```
finalScore = (engagementRatio × 0.4) + (recencyFactor × 0.2) + (sentimentScore × 0.4)
```

- **Engagement Ratio** (40%): Likes / Views
- **Recency Factor** (20%): How recent is the video
- **Sentiment Score** (40%): Gemini AI comment analysis

This weighting gives comment sentiment equal importance to engagement.

## Disabling Gemini (Fallback to Basic Sentiment)

If you want to disable Gemini and only use basic sentiment:

1. **Option A**: Don't set `GEMINI_API_KEY` in `.env` - system auto-detects and uses fallback
2. **Option B**: Comment out the Gemini initialization in `youtubeService.js`:
   ```javascript
   // let genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
   ```

## References

- [Google Generative AI Documentation](https://ai.google.dev/)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [AI Studio (Get API Key)](https://aistudio.google.com/app/apikey)
