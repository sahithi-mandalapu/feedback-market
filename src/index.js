// src/index.js - Main Worker Entry Point
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
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    const { useState } = React;
    const e = React.createElement;

    const TrendingUp = () => e('svg', { className: 'w-4 h-4 text-green-500', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, 
      e('polyline', { points: '23 6 13.5 15.5 8.5 10.5 1 18' }),
      e('polyline', { points: '17 6 23 6 23 12' })
    );

    const TrendingDown = () => e('svg', { className: 'w-4 h-4 text-red-500', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
      e('polyline', { points: '23 18 13.5 8.5 8.5 13.5 1 6' }),
      e('polyline', { points: '17 18 23 18 23 12' })
    );

    const AlertCircle = () => e('svg', { className: 'w-5 h-5 text-orange-400', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
      e('circle', { cx: '12', cy: '12', r: '10' }),
      e('line', { x1: '12', y1: '8', x2: '12', y2: '12' }),
      e('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' })
    );

    const App = () => {
      const [claims, setClaims] = useState([
        {
          id: 1,
          text: "New users are confused by pricing tiers",
          signalWeight: 78,
          trend: 'up',
          sources: ['support', 'discord', 'email'],
          segments: ['new_users', 'free_tier'],
          stakesFor: 45,
          stakesAgainst: 12,
          lastReinforced: 2,
          representativeness: 'medium',
          linkedDecisions: ['Pricing page redesign Q4']
        },
        {
          id: 2,
          text: "API documentation is blocking adoption",
          signalWeight: 85,
          trend: 'up',
          sources: ['support', 'github', 'twitter'],
          segments: ['developers', 'enterprise', 'new_users'],
          stakesFor: 62,
          stakesAgainst: 5,
          lastReinforced: 1,
          representativeness: 'high',
          linkedDecisions: ['API v2 launch']
        },
        {
          id: 3,
          text: "Power users want advanced filtering in dashboard",
          signalWeight: 52,
          trend: 'stable',
          sources: ['github', 'community'],
          segments: ['power_users'],
          stakesFor: 28,
          stakesAgainst: 8,
          lastReinforced: 5,
          representativeness: 'low',
          linkedDecisions: []
        },
        {
          id: 4,
          text: "Mobile app crashes on iOS 18",
          signalWeight: 31,
          trend: 'down',
          sources: ['support', 'twitter'],
          segments: ['mobile_users'],
          stakesFor: 15,
          stakesAgainst: 22,
          lastReinforced: 12,
          representativeness: 'low',
          linkedDecisions: ['iOS 18 compatibility patch']
        },
        {
          id: 5,
          text: "Export feature lacks CSV formatting options",
          signalWeight: 24,
          trend: 'down',
          sources: ['email'],
          segments: ['power_users'],
          stakesFor: 8,
          stakesAgainst: 18,
          lastReinforced: 18,
          representativeness: 'very_low',
          linkedDecisions: []
        }
      ]);
      
      const [tokens, setTokens] = useState(100);
      const [selected, setSelected] = useState(null);
      const [filter, setFilter] = useState('all');

      const stake = (id, direction) => {
        if (tokens < 10) {
          alert('Not enough tokens! Wait for next sprint refresh.');
          return;
        }
        setClaims(claims.map(c => c.id === id ? {
          ...c,
          stakesFor: direction === 'for' ? c.stakesFor + 10 : c.stakesFor,
          stakesAgainst: direction === 'against' ? c.stakesAgainst + 10 : c.stakesAgainst,
          signalWeight: direction === 'for' ? c.signalWeight + 5 : c.signalWeight - 3
        } : c));
        setTokens(tokens - 10);
      };

      const filteredClaims = claims
        .filter(c => {
          if (filter === 'high') return c.signalWeight >= 70;
          if (filter === 'active') return c.lastReinforced <= 7;
          if (filter === 'decaying') return c.lastReinforced > 14;
          return true;
        })
        .sort((a, b) => b.signalWeight - a.signalWeight);

      return e('div', { className: 'min-h-screen bg-slate-950 text-gray-100 p-6' },
        e('div', { className: 'max-w-7xl mx-auto' },
          // Header
          e('div', { className: 'mb-8' },
            e('div', { className: 'flex items-center justify-between mb-2' },
              e('h1', { className: 'text-3xl font-bold text-white' }, 'Feedback Market'),
              e('div', { className: 'bg-slate-800 px-4 py-2 rounded-lg border border-slate-700' },
                e('span', { className: 'text-gray-400 text-sm' }, 'Your Belief Tokens: '),
                e('span', { className: 'ml-2 text-2xl font-bold text-blue-400' }, tokens)
              )
            ),
            e('p', { className: 'text-gray-400 text-sm' }, 'Managing product feedback as evolving beliefs, not static data')
          ),

          // Filters
          e('div', { className: 'mb-6 flex gap-3' },
            ['all', 'high', 'active', 'decaying'].map(f => 
              e('button', {
                key: f,
                onClick: () => setFilter(f),
                className: 'px-4 py-2 rounded-lg transition ' + (filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700')
              }, f === 'all' ? 'All Claims' : f === 'high' ? 'High Signal' : f === 'active' ? 'Active' : 'Decaying')
            )
          ),

          // Claims List
          e('div', { className: 'grid gap-4' },
            filteredClaims.map(claim => 
              e('div', { 
                key: claim.id,
                className: 'bg-slate-900 border border-slate-700 rounded-lg p-6 hover:border-slate-600 cursor-pointer transition',
                onClick: () => setSelected(selected === claim.id ? null : claim.id)
              },
                e('div', { className: 'flex items-start justify-between mb-4' },
                  e('div', { className: 'flex-1' },
                    e('div', { className: 'flex items-center gap-3 mb-2' },
                      claim.trend === 'up' ? e(TrendingUp) : claim.trend === 'down' ? e(TrendingDown) : e('div', { className: 'w-4 h-4 bg-gray-300 rounded-full' }),
                      e('h3', { className: 'text-lg font-semibold text-white' }, claim.text)
                    ),
                    e('div', { className: 'flex items-center gap-4 text-sm text-gray-400' },
                      e('span', null, 'Signal: ', e('span', { className: 'font-bold text-white' }, claim.signalWeight)),
                      e('span', null, claim.lastReinforced + 'd ago'),
                      e('span', { className: claim.representativeness === 'high' ? 'text-green-400' : claim.representativeness === 'low' || claim.representativeness === 'very_low' ? 'text-orange-400' : 'text-yellow-400' }, 
                        claim.representativeness.replace('_', ' ')
                      )
                    )
                  ),
                  e('div', { className: 'flex flex-col items-end gap-2' },
                    e('div', { className: 'text-right' },
                      e('div', { className: 'text-2xl font-bold text-green-400' }, '+' + claim.stakesFor),
                      e('div', { className: 'text-xs text-gray-500' }, 'belief for')
                    ),
                    e('div', { className: 'text-right' },
                      e('div', { className: 'text-2xl font-bold text-red-400' }, '−' + claim.stakesAgainst),
                      e('div', { className: 'text-xs text-gray-500' }, 'belief against')
                    )
                  )
                ),

                // Expanded Details
                selected === claim.id && e('div', { className: 'mt-4 pt-4 border-t border-slate-700' },
                  e('div', { className: 'grid grid-cols-2 gap-4 mb-4' },
                    e('div', null,
                      e('div', { className: 'text-xs text-gray-500 mb-1' }, 'Sources'),
                      e('div', { className: 'flex gap-2 flex-wrap' },
                        claim.sources.map(s => e('span', { key: s, className: 'px-2 py-1 bg-slate-800 rounded text-xs text-gray-300' }, s))
                      )
                    ),
                    e('div', null,
                      e('div', { className: 'text-xs text-gray-500 mb-1' }, 'User Segments'),
                      e('div', { className: 'flex gap-2 flex-wrap' },
                        claim.segments.map(s => e('span', { key: s, className: 'px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-300' }, s.replace('_', ' ')))
                      )
                    )
                  ),

                  // Low representativeness warning
                  (claim.representativeness === 'low' || claim.representativeness === 'very_low') && 
                    e('div', { className: 'mb-4 p-3 bg-orange-900/20 border border-orange-800/50 rounded flex items-start gap-2' },
                      e(AlertCircle),
                      e('div', null,
                        e('div', { className: 'text-sm font-semibold text-orange-300' }, 'Low Representativeness Warning'),
                        e('div', { className: 'text-xs text-orange-400/80' }, 'This claim is driven by a narrow segment. Silent majority may disagree.')
                      )
                    ),

                  // Linked decisions
                  claim.linkedDecisions.length > 0 && e('div', { className: 'mb-4' },
                    e('div', { className: 'text-xs text-gray-500 mb-1' }, 'Linked to Decisions'),
                    claim.linkedDecisions.map((d, i) => e('div', { key: i, className: 'text-sm text-purple-400' }, '→ ' + d))
                  ),

                  // Action buttons
                  e('div', { className: 'flex gap-3 mt-4' },
                    e('button', {
                      className: 'flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition',
                      onClick: (ev) => { ev.stopPropagation(); stake(claim.id, 'for'); }
                    }, 'Stake FOR (−10 tokens)'),
                    e('button', {
                      className: 'flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition',
                      onClick: (ev) => { ev.stopPropagation(); stake(claim.id, 'against'); }
                    }, 'Stake AGAINST (−10 tokens)')
                  )
                )
              )
            )
          ),

          // System Insights
          e('div', { className: 'mt-8 bg-slate-900 border border-slate-700 rounded-lg p-6' },
            e('h2', { className: 'text-xl font-bold text-white mb-4' }, 'System Insights'),
            e('div', { className: 'grid grid-cols-3 gap-4' },
              e('div', { className: 'bg-slate-800 p-4 rounded' },
                e('div', { className: 'text-2xl font-bold text-blue-400' }, claims.filter(c => c.trend === 'up').length),
                e('div', { className: 'text-sm text-gray-400' }, 'Claims Gaining Strength')
              ),
              e('div', { className: 'bg-slate-800 p-4 rounded' },
                e('div', { className: 'text-2xl font-bold text-orange-400' }, claims.filter(c => c.lastReinforced > 14).length),
                e('div', { className: 'text-sm text-gray-400' }, 'Claims Decaying')
              ),
              e('div', { className: 'bg-slate-800 p-4 rounded' },
                e('div', { className: 'text-2xl font-bold text-red-400' }, claims.filter(c => c.representativeness === 'low' || c.representativeness === 'very_low').length),
                e('div', { className: 'text-sm text-gray-400' }, 'Low Representativeness')
              )
            )
          )
        )
      );
    };

    ReactDOM.render(React.createElement(App), document.getElementById('root'));
  </script>
</body>
</html>`;

import { FeedbackPipeline } from './workflows/feedback-pipeline.js';
export { FeedbackPipeline };
