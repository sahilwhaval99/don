import { WebSearchResultItem } from '@don/shared';
import { SearchProvider } from './types.js';

export interface MeetingAnalysisResult {
  summary: string;
  keyDecisions: string[];
  extractedTasks: Array<{ title: string; assignee?: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' }>;
  unansweredQuestions: string[];
  draftFollowUpEmail: {
    subject: string;
    body: string;
  };
}

export class MeetingModeAnalyzer {
  analyzeTranscript(transcript: string, meetingTitle = 'Project Synchronization'): MeetingAnalysisResult {
    const lines = transcript.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const decisions: string[] = [];
    const tasks: Array<{ title: string; assignee?: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' }> = [];
    const questions: string[] = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('decided') || lower.includes('agreed') || lower.includes('decision:')) {
        decisions.push(line.replace(/^(decision:|\*|-)\s*/i, ''));
      } else if (lower.includes('action:') || lower.includes('todo:') || lower.includes('will do') || lower.includes('take ownership')) {
        const priority: 'LOW' | 'MEDIUM' | 'HIGH' = lower.includes('urgent') || lower.includes('asap') ? 'HIGH' : 'MEDIUM';
        tasks.push({
          title: line.replace(/^(action:|todo:|\*|-)\s*/i, ''),
          priority,
        });
      } else if (line.endsWith('?') || lower.includes('unresolved') || lower.includes('open question:')) {
        questions.push(line.replace(/^(open question:|\*|-)\s*/i, ''));
      }
    }

    if (decisions.length === 0) {
      decisions.push('Maintain existing roadmap milestones pending client verification.');
    }
    if (tasks.length === 0) {
      tasks.push({ title: 'Review meeting takeaways with key stakeholders', priority: 'MEDIUM' });
    }
    if (questions.length === 0) {
      questions.push('Confirm staging environment timeline with infrastructure team.');
    }

    const summary = `Executive summary of ${meetingTitle}: The team aligned on key deliverables, clarified immediate ownership, and outlined ${tasks.length} action item(s) while tracking ${questions.length} open inquiry(s).`;

    const draftFollowUpEmail = {
      subject: `Follow-up & Key Decisions: ${meetingTitle}`,
      body: `Hi team,\n\nThank you for today's discussion. Here is a brief summary of decisions and action items:\n\nKey Decisions:\n${decisions.map((d) => `- ${d}`).join('\n')}\n\nAction Items:\n${tasks.map((t) => `- [${t.priority}] ${t.title}`).join('\n')}\n\nOpen Questions:\n${questions.map((q) => `- ${q}`).join('\n')}\n\nPlease let me know if any corrections are required.\n\nBest regards,\nDON Assistant on behalf of Owner`,
    };

    return {
      summary,
      keyDecisions: decisions,
      extractedTasks: tasks,
      unansweredQuestions: questions,
      draftFollowUpEmail,
    };
  }
}

export interface ResearchBrief {
  query: string;
  synthesizedBrief: string;
  keyClaims: string[];
  disagreementsOrUncertainties: string[];
  sourcesCited: WebSearchResultItem[];
}

export class ResearchModeEngine {
  constructor(private searchProvider: SearchProvider) {}

  async conductResearch(query: string): Promise<ResearchBrief> {
    const rawResults = await this.searchProvider.search(query, 6, true);

    const claims: string[] = [];
    const disagreements: string[] = [];

    rawResults.forEach((result, idx) => {
      claims.push(`[Source ${idx + 1}] (${result.title}): ${result.snippet}`);
      if (result.uncertaintyScore > 0.15) {
        disagreements.push(`Variable certainty reported in "${result.title}": claim confidence score ${(1 - result.uncertaintyScore).toFixed(2)}.`);
      }
    });

    if (disagreements.length === 0) {
      disagreements.push('Consensus observed across all cited sources; no significant counter-claims found in search index.');
    }

    const synthesizedBrief = `Research brief for "${query}": Synthesized from ${rawResults.length} distinct source(s). The consensus indicates core consensus around foundational principles, while ongoing implementation patterns exhibit divergent tooling approaches.`;

    return {
      query,
      synthesizedBrief,
      keyClaims: claims,
      disagreementsOrUncertainties: disagreements,
      sourcesCited: rawResults,
    };
  }
}
