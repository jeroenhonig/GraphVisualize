
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { AlertCircle, CheckCircle, Info, Loader2, AlertTriangle } from 'lucide-react';
import { useApi } from '../hooks/use-api';
import ErrorBoundary from './error-boundary';

interface CodeIssue {
  line?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface CodeReviewResult {
  issues: CodeIssue[];
  overallFeedback: string;
  fixedCode?: string;
}

export default function CodeReviewer() {
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [context, setContext] = useState('');
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [fixedCode, setFixedCode] = useState('');

  const reviewApi = useApi<CodeReviewResult>({
    onSuccess: (data) => setReviewResult(data),
    onError: (error) => console.error('Review failed:', error)
  });

  const fixApi = useApi<{ fixedCode: string }>({
    onSuccess: (data) => setFixedCode(data.fixedCode),
    onError: (error) => console.error('Fix failed:', error)
  });

  const handleReview = async () => {
    if (!code.trim() || !filename.trim()) {
      alert('Please provide code and filename');
      return;
    }

    await reviewApi.execute('/api/code-review', {
      method: 'POST',
      body: JSON.stringify({
        code,
        filename,
        language,
        context: context.trim() || undefined,
      }),
    });
  };

  const handleFixBugs = async () => {
    if (!code.trim() || !filename.trim()) {
      alert('Please provide code and filename');
      return;
    }

    await fixApi.execute('/api/fix-bugs', {
      method: 'POST',
      body: JSON.stringify({
        code,
        filename,
        language,
      }),
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Claude Code Reviewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Filename (e.g., app.tsx)"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="cpp">C++</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="go">Go</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Optional context about what this code should do..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
          />

          <Textarea
            placeholder="Paste your code here..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={15}
            className="font-mono text-sm"
          />

          {(reviewApi.error || fixApi.error) && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  {reviewApi.error || fixApi.error}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={handleReview} disabled={reviewApi.loading}>
              {reviewApi.loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Review Code
            </Button>
            <Button onClick={handleFixBugs} disabled={fixApi.loading} variant="secondary">
              {fixApi.loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Fix Bugs
            </Button>
          </div>
        </CardContent>
      </Card>

      {reviewResult && (
        <Card>
          <CardHeader>
            <CardTitle>Review Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviewResult.issues.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Issues Found:</h3>
                <div className="space-y-3">
                  {reviewResult.issues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityColor(issue.severity) as any}>
                            {issue.severity}
                          </Badge>
                          {issue.line && (
                            <span className="text-sm text-muted-foreground">
                              Line {issue.line}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mb-2">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Suggestion:</strong> {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviewResult.issues.length === 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>No issues found!</span>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Overall Feedback:</h3>
              <p className="text-sm text-muted-foreground">{reviewResult.overallFeedback}</p>
            </div>

            {reviewResult.fixedCode && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Fixed Code:</h3>
                  <Textarea
                    value={reviewResult.fixedCode}
                    readOnly
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {fixedCode && (
        <Card>
          <CardHeader>
            <CardTitle>Fixed Code</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={fixedCode}
              readOnly
              rows={15}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
      </div>
    </ErrorBoundary>
  );
}
