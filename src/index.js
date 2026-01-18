// Main Worker Entry Point
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (url.pathname === '/api/claims') {
      return handleClaims(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/analyze-feedback') {
      return handleFeedbackAnalysis(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/workflow/process') {
      return handleWorkflowTrigger(request, env, corsHeaders);
    }

    if (url.pathname === '/api/search-similar') {
      return handleSemanticSearch(request, env, corsHeaders);
    }

    // Serve the React app
    return new Response(HTML_TEMPLATE, {
      headers: { 'Content-Type': 'text/html', ...corsHeaders }
    });
  }
};

// Handle Claims CRUD with D1
async function handleClaims(request, env, corsHeaders) {
  if (request.method === 'GET') {
    const claims = await env.feedback_market_db.prepare(
      'SELECT * FROM claims ORDER BY signal_weight DESC'
    ).all();
    
    return new Response(JSON.stringify(claims.results), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  
  if (request.method === 'POST') {
    const body = await request.json();
    const { text, sources, segments } = body;
    
    const result = await env.feedback_market_db.prepare(
      `INSERT INTO claims (text, signal_weight, sources, segments, created_at) 
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(text, 50, JSON.stringify(sources), JSON.stringify(segments)).run();
    
    return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// AI-powered feedback analysis with Workers AI
async function handleFeedbackAnalysis(request, env, corsHeaders) {
  const { feedbackText } = await request.json();
  
  // Use Workers AI for sentiment analysis and claim extraction
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'Extract product feedback claims from user input. Return JSON with: claim (string), sentiment (positive/negative/neutral), urgency (low/medium/high), segment (new_users/power_users/enterprise).'
      },
      {
        role: 'user',
        content: feedbackText
      }
    ]
  });
  
  const analysis = JSON.parse(response.response);
  
  // Store in D1
  await env.feedback_market_db.prepare(
    'INSERT INTO feedback_raw (text, analysis, created_at) VALUES (?, ?, datetime("now"))'
  ).bind(feedbackText, JSON.stringify(analysis)).run();
  
  // Check for similar claims using AI Search
  const similar = await findSimilarClaims(analysis.claim, env);
  
  return new Response(JSON.stringify({ analysis, similar }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Semantic search with AI Search (RAG)
async function findSimilarClaims(claimText, env) {
  try {
    const searchResults = await env.AI_SEARCH.search({
      query: claimText,
      limit: 3
    });
    
    return searchResults.results || [];
  } catch (e) {
    console.error('AI Search error:', e);
    return [];
  }
}

// Workflow orchestration for feedback pipeline
async function handleWorkflowTrigger(request, env, corsHeaders) {
  const { feedbackSource, data } = await request.json();
  
  // Create a new workflow instance
  const instance = await env.FEEDBACK_WORKFLOW.create({
    params: {
      source: feedbackSource,
      data: data,
      timestamp: Date.now()
    }
  });
  
  return new Response(JSON.stringify({ 
    workflowId: instance.id,
    status: 'processing' 
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback Market</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // Paste your React component code here
    const App = () => {
      return <div className="p-8 bg-slate-950 min-h-screen text-white">
        <h1 className="text-4xl font-bold mb-4">Feedback Market</h1>
        <p className="text-gray-400">Deployed on Cloudflare Workers</p>
      </div>
    };
    
    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>`;

import { FeedbackPipeline } from './workflows/feedback-pipeline.js';
export { FeedbackPipeline };