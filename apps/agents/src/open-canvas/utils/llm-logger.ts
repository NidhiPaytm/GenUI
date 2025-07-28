import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { BaseMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';

// Cache for request information to ensure consistency within the same request
const requestInfoCache = new Map<string, {
    threadId?: string;
    requestId: string;
    timestamp: string;
}>();

export class SimpleLLMLogger {
    private static baseDir = path.join(process.cwd(), 'llm_logs');

    static async ensureLogDirectory(): Promise<void> {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    static async logLLMStep(
        stepName: string,
        systemPrompt: string,
        userPrompt: string,
        output: string,
        options?: {
            threadId?: string;
            requestId?: string;
            timestamp?: string;
        }
    ): Promise<void> {
        try {
            await this.ensureLogDirectory();

            const threadId = options?.threadId || 'unknown-thread';
            const requestId = options?.requestId || uuidv4();
            const timestamp = options?.timestamp || format(new Date(), 'yyyy-MM-dd-HH-mm-ss-SSS');

            // Create a unique directory for this request
            const requestDir = path.join(this.baseDir, `${threadId}_${requestId}_${timestamp}`);
            if (!fs.existsSync(requestDir)) {
                fs.mkdirSync(requestDir, { recursive: true });
            }

            // Create step subdirectory
            const stepDir = path.join(requestDir, stepName);
            if (!fs.existsSync(stepDir)) {
                fs.mkdirSync(stepDir, { recursive: true });
            }

            const inputFile = path.join(stepDir, 'input.txt');
            const promptFile = path.join(stepDir, 'prompt.txt');
            const outputFile = path.join(stepDir, 'output.txt');
            const metadataFile = path.join(stepDir, 'metadata.json');

            const inputContent = systemPrompt || 'No system prompt';
            const promptContent = userPrompt || 'No user prompt';
            const outputContent = output || 'No output';

            // Create metadata with request info
            const metadata = {
                threadId,
                requestId,
                timestamp,
                stepName,
                loggedAt: new Date().toISOString(),
            };

            await Promise.all([
                fs.promises.writeFile(inputFile, inputContent, 'utf-8'),
                fs.promises.writeFile(promptFile, promptContent, 'utf-8'),
                fs.promises.writeFile(outputFile, outputContent, 'utf-8'),
                fs.promises.writeFile(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8'),
            ]);

            console.log(`✅ LLM call logged: ${stepName} -> ${requestDir}`);
        } catch (error) {
            console.error(`❌ Failed to log LLM call for ${stepName}:`, error);
        }
    }

    // Legacy method for backward compatibility
    static async logLLMStepLegacy(
        stepName: string,
        systemPrompt: string,
        userPrompt: string,
        output: string
    ): Promise<void> {
        return this.logLLMStep(stepName, systemPrompt, userPrompt, output);
    }

    // Clear cache for a specific thread (useful for cleanup)
    static clearRequestCache(threadId?: string): void {
        if (threadId) {
            requestInfoCache.delete(threadId);
        } else {
            requestInfoCache.clear();
        }
    }
}

// Helper function to extract system prompt from messages
export function extractSystemPrompt(messages: any[]): string {
    const systemMessage = messages.find(msg =>
        (typeof msg === 'object' && msg.role === 'system') ||
        (msg.getType && msg.getType() === 'system')
    );

    if (systemMessage) {
        return typeof systemMessage.content === 'string'
            ? systemMessage.content
            : JSON.stringify(systemMessage.content);
    }

    return '';
}

// Helper function to extract user prompt from messages
export function extractUserPrompt(messages: any[]): string {
    const userMessages = messages.filter(msg =>
        (typeof msg === 'object' && msg.role === 'user') ||
        (msg.getType && msg.getType() === 'human')
    );

    if (userMessages.length > 0) {
        return userMessages.map(msg => {
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content);
            return content;
        }).join('\n\n--- Next user message ---\n\n');
    }

    return '';
}

// Helper function to extract output content
export function extractOutputContent(response: any): string {
    if (!response) return '';

    // If response has content property
    if (response.content) {
        return typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
    }

    if (response.tool_calls?.[0]?.args) {
        return JSON.stringify(response.tool_calls[0].args, null, 2);
    }

    // If response is a string
    if (typeof response === 'string') {
        return response;
    }

    // If response is an object, stringify it
    if (typeof response === 'object') {
        return JSON.stringify(response, null, 2);
    }

    return String(response);
}

// Enhanced helper function to extract request info from LangGraph config with caching
export function extractRequestInfo(config: any): {
    threadId?: string;
    requestId: string;
    timestamp: string;
} {
    const threadId = config?.configurable?.thread_id;
    const cacheKey = threadId || 'no-thread';

    // Check if we already have cached info for this thread
    if (requestInfoCache.has(cacheKey)) {
        const cached = requestInfoCache.get(cacheKey)!;
        return cached;
    }

    // Generate new request info
    const requestId = uuidv4();
    const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm-ss-SSS');

    const requestInfo = {
        threadId,
        requestId,
        timestamp,
    };

    // Cache the request info
    requestInfoCache.set(cacheKey, requestInfo);

    // Set up cleanup after some time (optional, to prevent memory leaks)
    setTimeout(() => {
        requestInfoCache.delete(cacheKey);
    }, 30 * 60 * 1000); // Clean up after 30 minutes

    return requestInfo;
}

// Helper function to manually clear cache when request is complete
export function clearRequestCache(threadId?: string): void {
    SimpleLLMLogger.clearRequestCache(threadId);
} 