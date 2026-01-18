// import { WorkflowEntrypoint } from '@cloudflare/workers-types'; // optional, just for reference

export class FeedbackPipeline // extends WorkflowEntrypoint 
{
  async run(params) {
    // Step 1: Analyze with AI
    const analysis = await this.step('analyze', async () => {
      return await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Analyze this feedback: ${params.data}`
        }]
      });
    });
    
    // Step 2: Find duplicates
    const duplicates = await this.step('find-duplicates', async () => {
      return await this.env.findSimilarClaims(analysis.claim);
    });
    
    // Step 3: Update or create claim
    await this.step('update-claim', async () => {
      if (duplicates.length > 0) {
        // Reinforce existing claim
        await this.env.feedback_market_db.prepare(
          'UPDATE claims SET signal_weight = signal_weight + 5, last_reinforced = datetime("now") WHERE id = ?'
        ).bind(duplicates[0].id).run();
      } else {
        // Create new claim
        await this.env.feedback_market_db.prepare(
          'INSERT INTO claims (text, signal_weight, sources) VALUES (?, 50, ?)'
        ).bind(analysis.claim, JSON.stringify([params.source])).run();
      }
    });
    
    return { success: true, duplicates: duplicates.length };
  }
}
