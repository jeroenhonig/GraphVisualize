
import Anthropic from '@anthropic-ai/sdk';

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

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    throw new Error('Failed to parse Claude response');
  } catch (error) {
    console.error('Code review error:', error);
    throw new Error('Failed to review code with Claude');
  }
}

export async function fixBugs(code: string, filename: string, language: string): Promise<string> {
  const prompt = `Fix all bugs and issues in this ${language} code from "${filename}":

\`\`\`${language}
${code}
\`\`\`

Please return only the corrected code without explanations or markdown formatting.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }

    throw new Error('Failed to get fixed code from Claude');
  } catch (error) {
    console.error('Bug fixing error:', error);
    throw new Error('Failed to fix bugs with Claude');
  }
}
