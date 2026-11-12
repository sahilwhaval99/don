import { FastifyInstance } from 'fastify';
import child_process from 'child_process';
import { MockAIProvider, GeminiAIProvider, AIContext, ChatMessage, UnifiedSearchProvider } from '@don/ai';
import { db } from '../db/index.js';
import { auditService } from '../services/audit.service.js';
import { relayService } from '../services/relay.service.js';

export async function chatRoutes(fastify: FastifyInstance) {
  // Chat Endpoint with Dynamic AI Provider & Search Engine Support
  fastify.post('/api/chat', async (req, reply) => {
    const body = req.body as {
      message: string;
      history?: ChatMessage[];
      geminiApiKey?: string;
      googleSearchApiKey?: string;
      googleSearchEngineId?: string;
    };
    const prompt = body.message || '';
    const owner = Array.from(db.users.values())[0];
    const userId = owner?.id || '00000000-0000-0000-0000-000000000001';

    // 1. Check Kill Switch
    if (db.killSwitch.isActivated) {
      auditService.record({
        userId,
        toolName: 'chat_attempt',
        parameters: { prompt },
        targetResource: 'SYSTEM',
        consequenceSummary: 'Tool execution blocked by active Emergency Kill Switch.',
        status: 'BLOCKED_BY_KILL_SWITCH',
        decisionMadeBy: 'KILL_SWITCH',
      });

      return reply.status(200).send({
        reply: '⚠️ EMERGENCY KILL SWITCH ACTIVE: All tool executions, automations, and device actions are currently locked. Disengage the kill switch in the dashboard banner to resume automated actions.',
        toolProposals: [],
        usedMemories: [],
        citations: [],
      });
    }

    // 2. Prepare AI Context
    const memories = Array.from(db.memories.values()).map((m) => ({
      id: m.id,
      key: m.key,
      content: m.content,
    }));
    const docs = Array.from(db.documents.values()).map((d) => ({
      id: d.id,
      name: d.name,
      text: d.rawText,
    }));
    const allowlistedApps = Array.from(db.allowlistedApps.values()).map((a) => ({
      id: a.id,
      appName: a.appName,
      executablePath: a.executablePath,
    }));

    const context: AIContext = {
      userId,
      userName: owner?.name || 'Commander',
      userTimezone: 'UTC',
      recentMemories: memories,
      connectedDocuments: docs,
      allowlistedApps,
    };

    const messages: ChatMessage[] = [
      ...(body.history || []),
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];

    // 3. Choose AI Provider (Gemini if key provided, else IntelligentAssistantProvider)
    const geminiKey = body.geminiApiKey || process.env.GEMINI_API_KEY;
    const provider =
      geminiKey && !geminiKey.includes('placeholder')
        ? new GeminiAIProvider(geminiKey)
        : new MockAIProvider();

    // 4. Generate AI response and tool proposals
    const response = await provider.generateResponse(messages, context);

    // 5. Register pending approvals for proposals requiring confirmation
    for (const proposal of response.toolProposals) {
      if (proposal.requiresApproval) {
        db.approvals.set(proposal.id, { ...proposal, userId });
        auditService.record({
          userId,
          toolName: proposal.toolName,
          parameters: proposal.parameters,
          targetResource: proposal.consequence.target,
          consequenceSummary: proposal.consequence.description,
          status: 'AWAITING_APPROVAL',
          decisionMadeBy: 'AGENT_PROPOSAL',
        });

        // Broadcast to paired devices (e.g. Android push or Desktop agent)
        relayService.broadcast({
          id: crypto.randomUUID(),
          type: 'APPROVAL_REQUEST',
          payload: proposal as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return reply.status(200).send(response);
  });

  // Dedicated Google & Web Search Endpoint
  fastify.post('/api/search', async (req, reply) => {
    const body = req.body as {
      query: string;
      maxResults?: number;
      googleApiKey?: string;
      googleCx?: string;
    };
    const query = (body.query || '').trim();
    if (!query) {
      return reply.status(400).send({ error: 'Search query parameter is required.' });
    }

    const searchProvider = new UnifiedSearchProvider(body.googleApiKey, body.googleCx);
    const results = await searchProvider.search(query, body.maxResults || 5, true);
    return reply.status(200).send({ query, results });
  });

  // Approvals Listing
  fastify.get('/api/approvals', async (_req, reply) => {
    const list = Array.from(db.approvals.values()).filter((a) => a.status === 'PENDING');
    return reply.status(200).send(list);
  });

  // Approval Decision Endpoint
  fastify.post('/api/approvals/:id/decide', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { decision: 'APPROVE' | 'DENY'; deviceId?: string };

    const proposal = db.approvals.get(id);
    if (!proposal) {
      return reply.status(404).send({ error: 'Approval request not found or expired.' });
    }

    // Check Kill Switch again
    if (body.decision === 'APPROVE' && db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'Cannot approve action: Emergency Kill Switch is engaged.' });
    }

    if (body.decision === 'DENY') {
      proposal.status = 'REJECTED';
      db.approvals.set(id, proposal);

      auditService.record({
        userId: proposal.userId,
        deviceId: body.deviceId,
        toolName: proposal.toolName,
        parameters: proposal.parameters,
        targetResource: proposal.consequence.target,
        consequenceSummary: `User denied approval for ${proposal.toolName}`,
        status: 'DENIED',
        decisionMadeBy: 'USER',
      });

      return reply.status(200).send({
        status: 'DENIED',
        message: `Action on ${proposal.consequence.target} was explicitly denied by user.`,
        proposal,
      });
    }

    // User APPROVED
    proposal.status = 'APPROVED';
    db.approvals.set(id, proposal);

    // Relay action to target execution agent
    if (proposal.consequence.requiresLocalAgent) {
      relayService.broadcast({
        id: crypto.randomUUID(),
        type: 'EXECUTE_DESKTOP_APP',
        payload: { proposalId: id, parameters: proposal.parameters },
        timestamp: new Date().toISOString(),
      });

      // On local Windows system, execute allowlisted app immediately
      if (process.platform === 'win32' && proposal.toolName === 'propose_open_desktop_app') {
        const appName = String(proposal.parameters?.appName || '').toLowerCase();
        let exePath: string | null = null;
        if (appName.includes('calc')) exePath = 'calc.exe';
        else if (appName.includes('notepad')) exePath = 'notepad.exe';
        else if (appName.includes('paint')) exePath = 'mspaint.exe';
        else if (appName.includes('terminal') || appName.includes('cmd')) exePath = 'cmd.exe';

        if (exePath) {
          try {
            const child = child_process.spawn('cmd.exe', ['/c', 'start', '', exePath], {
              detached: true,
              stdio: 'ignore',
            });
            if (child && typeof child.on === 'function') {
              child.on('error', () => { /* ignore spawn errors */ });
            }
            child.unref();
          } catch (e: any) {
            console.warn('Local app launch notice:', e.message);
          }
        }
      }
    } else if (proposal.consequence.requiresAndroidCompanion) {
      relayService.broadcast({
        id: crypto.randomUUID(),
        type: 'APPROVAL_DECISION',
        payload: { proposalId: id, approved: true, parameters: proposal.parameters },
        timestamp: new Date().toISOString(),
      });

      // Trigger dialer protocol on Windows if dialer intent requested
      if (process.platform === 'win32' && proposal.parameters?.phoneNumber) {
        try {
          const phoneUrl = `tel:${String(proposal.parameters.phoneNumber).replace(/\s+/g, '')}`;
          child_process.spawn('cmd.exe', ['/c', 'start', '', phoneUrl], { detached: true, stdio: 'ignore' }).unref();
        } catch {
          // Ignore dialer registration error
        }
      }
    } else if (proposal.toolName === 'propose_open_website' && proposal.parameters?.url) {
      const url = String(proposal.parameters.url);
      if (process.platform === 'win32') {
        try {
          child_process.spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
        } catch {
          // Ignore website handler registration error
        }
      }
    }

    auditService.record({
      userId: proposal.userId,
      deviceId: body.deviceId,
      toolName: proposal.toolName,
      parameters: proposal.parameters,
      targetResource: proposal.consequence.target,
      consequenceSummary: `Approved and dispatched: ${proposal.consequence.description}`,
      status: 'APPROVED',
      decisionMadeBy: 'USER',
    });

    return reply.status(200).send({
      status: 'APPROVED',
      message: `Action on ${proposal.consequence.target} confirmed and dispatched to target agent.`,
      proposal,
    });
  });
}
