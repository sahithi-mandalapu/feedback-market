-- Claims table: stores product feedback claims
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  signal_weight INTEGER DEFAULT 50,
  trend TEXT DEFAULT 'stable', -- up, down, stable
  sources TEXT, -- JSON array of sources
  segments TEXT, -- JSON array of user segments
  stakes_for INTEGER DEFAULT 0,
  stakes_against INTEGER DEFAULT 0,
  last_reinforced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  representativeness TEXT DEFAULT 'medium', -- very_low, low, medium, high
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  linked_decisions TEXT -- JSON array of linked product decisions
);

-- Raw feedback table: stores unprocessed feedback
CREATE TABLE IF NOT EXISTS feedback_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  source TEXT, -- support, discord, github, email, twitter
  analysis TEXT, -- JSON of AI analysis
  processed BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Belief stakes table: tracks team member stakes
CREATE TABLE IF NOT EXISTS belief_stakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER,
  user_id TEXT,
  direction TEXT, -- for, against
  tokens_spent INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES claims(id)
);

-- Decay tracking: automated signal weight decay
CREATE TABLE IF NOT EXISTS decay_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER,
  old_weight INTEGER,
  new_weight INTEGER,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES claims(id)
);

-- Create indexes for performance
CREATE INDEX idx_claims_signal ON claims(signal_weight DESC);
CREATE INDEX idx_claims_created ON claims(created_at DESC);
CREATE INDEX idx_feedback_processed ON feedback_raw(processed, created_at);
CREATE INDEX idx_stakes_claim ON belief_stakes(claim_id);