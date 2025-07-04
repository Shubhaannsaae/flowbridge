import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

export interface AIModelConfig {
  modelName: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  stopSequences?: string[];
}

export interface AIServiceConfig {
  gemini: {
    apiKey: string;
    models: {
      pro: AIModelConfig;
      flash: AIModelConfig;
      vision: AIModelConfig;
    };
    requestTimeout: number;
    retryAttempts: number;
    rateLimits: {
      requestsPerMinute: number;
      tokensPerMinute: number;
    };
  };
}

const AI_CONFIG: AIServiceConfig = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
    models: {
      pro: {
        modelName: 'gemini-pro',
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      },
      flash: {
        modelName: 'gemini-1.5-flash',
        maxTokens: 8192,
        temperature: 0.5,
        topP: 0.9,
        topK: 32
      },
      vision: {
        modelName: 'gemini-pro-vision',
        maxTokens: 2048,
        temperature: 0.4,
        topP: 0.8,
        topK: 32
      }
    },
    requestTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  }
};

class AIConfig {
  private genAI: GoogleGenerativeAI;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    if (!AI_CONFIG.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(AI_CONFIG.gemini.apiKey);
    this.setupRateLimitReset();
  }

  private setupRateLimitReset(): void {
    // Reset rate limit counters every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.requestCounts) {
        if (now >= data.resetTime) {
          this.requestCounts.delete(key);
        }
      }
    }, 60000);
  }

  getGeminiModel(modelType: 'pro' | 'flash' | 'vision' = 'pro') {
    const config = AI_CONFIG.gemini.models[modelType];
    return this.genAI.getGenerativeModel({
      model: config.modelName,
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        stopSequences: config.stopSequences
      }
    });
  }

  async generateContent(
    prompt: string,
    modelType: 'pro' | 'flash' | 'vision' = 'pro',
    options?: {
      timeout?: number;
      retries?: number;
      context?: string;
    }
  ): Promise<string> {
    const requestId = this.generateRequestId();
    
    try {
      // Check rate limits
      await this.checkRateLimit('requests');
      
      const model = this.getGeminiModel(modelType);
      const timeout = options?.timeout || AI_CONFIG.gemini.requestTimeout;
      const retries = options?.retries || AI_CONFIG.gemini.retryAttempts;
      
      let fullPrompt = prompt;
      if (options?.context) {
        fullPrompt = `Context: ${options.context}\n\nPrompt: ${prompt}`;
      }

      logger.info(`AI request started: ${requestId}`, {
        modelType,
        promptLength: fullPrompt.length,
        timeout
      });

      const result = await this.executeWithRetry(
        () => this.executeWithTimeout(
          () => model.generateContent(fullPrompt),
          timeout
        ),
        retries
      );

      const response = result.response.text();
      
      // Track token usage
      await this.trackTokenUsage(response.length);
      
      logger.info(`AI request completed: ${requestId}`, {
        responseLength: response.length,
        modelType
      });

      return response;

    } catch (error) {
      logger.error(`AI request failed: ${requestId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        modelType,
        promptLength: prompt.length
      });
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateStructuredContent<T>(
    prompt: string,
    schema: any,
    modelType: 'pro' | 'flash' | 'vision' = 'pro'
  ): Promise<T> {
    const structuredPrompt = `
${prompt}

Please respond ONLY with valid JSON that matches this schema:
${JSON.stringify(schema, null, 2)}

Response (JSON only):
`;

    try {
      const response = await this.generateContent(structuredPrompt, modelType);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Basic validation against schema
      this.validateAgainstSchema(parsedResponse, schema);
      
      return parsedResponse as T;

    } catch (error) {
      logger.error('Structured content generation failed:', error);
      throw new Error(`Structured AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeMarketData(data: any): Promise<any> {
    const prompt = `
You are an expert DeFi analyst. Analyze the following market data and provide insights:

${JSON.stringify(data, null, 2)}

Provide analysis covering:
1. Market trends and patterns
2. Risk assessment
3. Opportunities and threats
4. Recommendations for DeFi portfolio optimization

Format your response as structured JSON with clear sections.
`;

    return await this.generateStructuredContent(prompt, {
      marketTrends: { type: 'object' },
      riskAssessment: { type: 'object' },
      opportunities: { type: 'array' },
      recommendations: { type: 'array' }
    });
  }

  async optimizePortfolio(portfolioData: any, preferences: any): Promise<any> {
    const prompt = `
You are an AI portfolio optimizer for DeFi investments. Given the following portfolio data and user preferences, provide optimization recommendations:

Portfolio Data:
${JSON.stringify(portfolioData, null, 2)}

User Preferences:
${JSON.stringify(preferences, null, 2)}

Provide detailed optimization recommendations including:
1. Suggested asset allocation changes
2. Risk-adjusted return projections
3. Rebalancing strategy
4. Timeline for implementation

Respond with structured JSON format.
`;

    return await this.generateStructuredContent(prompt, {
      allocations: { type: 'array' },
      projections: { type: 'object' },
      strategy: { type: 'object' },
      timeline: { type: 'string' }
    });
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        logger.warn(`AI request attempt ${attempt} failed, retrying in ${delay}ms:`, {
          error: lastError.message
        });
      }
    }

    throw lastError!;
  }

  private async checkRateLimit(type: 'requests' | 'tokens'): Promise<void> {
    const now = Date.now();
    const resetTime = now + 60000; // 1 minute from now
    
    const current = this.requestCounts.get(type) || { count: 0, resetTime };
    
    if (now >= current.resetTime) {
      // Reset counter
      this.requestCounts.set(type, { count: 1, resetTime });
      return;
    }

    const limit = type === 'requests' 
      ? AI_CONFIG.gemini.rateLimits.requestsPerMinute 
      : AI_CONFIG.gemini.rateLimits.tokensPerMinute;

    if (current.count >= limit) {
      const waitTime = current.resetTime - now;
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`);
    }

    current.count++;
    this.requestCounts.set(type, current);
  }

  private async trackTokenUsage(responseLength: number): Promise<void> {
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(responseLength / 4);
    
    const current = this.requestCounts.get('tokens') || { count: 0, resetTime: Date.now() + 60000 };
    current.count += estimatedTokens;
    this.requestCounts.set('tokens', current);
  }

  private validateAgainstSchema(data: any, schema: any): void {
    // Basic schema validation
    if (schema.type === 'object' && typeof data !== 'object') {
      throw new Error('Response does not match expected object type');
    }
    
    if (schema.type === 'array' && !Array.isArray(data)) {
      throw new Error('Response does not match expected array type');
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getConfig(): AIServiceConfig {
    return AI_CONFIG;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.getGeminiModel('flash');
      const result = await this.executeWithTimeout(
        () => model.generateContent('Test connection. Respond with "OK".'),
        10000
      );
      
      const response = result.response.text();
      return response.toLowerCase().includes('ok');

    } catch (error) {
      logger.error('AI service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const aiConfig = new AIConfig();

export default aiConfig;
