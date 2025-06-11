import Anthropic from '@anthropic-ai/sdk';

// Validate API key on module load
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CodeReviewRequest {
  code: string;
  filename: string;
  language: string;
  context?: string;
}

export interface CodeReviewResponse {
  issues: Array<{
    line?: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  overallFeedback: string;
  fixedCode?: string;
}

export async function reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse> {
  const prompt = `Please review the following ${request.language} code from file "${request.filename}":

${request.context ? `Context: ${request.context}\n` : ''}

\`\`\`${request.language}
${request.code}
\`\`\`

Please provide:
1. A list of issues (bugs, potential problems, code quality issues)
2. Overall feedback on the code quality and architecture
3. If there are critical bugs, provide a fixed version of the code

Format your response as JSON with this structure:
{
  "issues": [
    {
      "line": <line_number_or_null>,
      "severity": "error"|"warning"|"info",
      "message": "description of the issue",
      "suggestion": "how to fix it"
    }
  ],
  "overallFeedback": "general assessment of the code",
  "fixedCode": "corrected code if critical bugs were found, otherwise null"
}`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from the response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate response structure
          if (parsed.issues && Array.isArray(parsed.issues) && parsed.overallFeedback) {
            return parsed;
          }
        }
      }

      throw new Error('Invalid response format from Claude');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Code review attempt ${attempt} failed:`, lastError.message);

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error(`Failed to review code after ${maxRetries} attempts: ${lastError?.message}`);
}

export async function fixBugs(code: string, filename: string, language: string): Promise<string> {
  const prompt = `Fix all bugs and issues in this ${language} code from "${filename}":

\`\`\`${language}
${code}
\`\`\`

Please return only the corrected code without explanations or markdown formatting.`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const content = response.content[0];
      if (content.type === 'text') {
        const fixedCode = content.text.trim();
        if (fixedCode.length > 0) {
          return fixedCode;
        }
      }

      throw new Error('Empty response from Claude');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Bug fixing attempt ${attempt} failed:`, lastError.message);

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error(`Failed to fix bugs after ${maxRetries} attempts: ${lastError?.message}`);
}