'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOutreach, generateOutreach, updateOutreach } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Zap, Loader2, Copy, CheckCheck, Send } from 'lucide-react';

const CHANNEL_LABELS: Record<string, string> = {
  email: '📧 Email',
  whatsapp: '💬 WhatsApp',
  linkedin: '💼 LinkedIn',
  cold_call_script: '📞 Call Script',
};

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgent', label: 'Urgent' },
];

export function OutreachPanel({ leadId }: { leadId: string }) {
  const [selectedTone, setSelectedTone] = useState('professional');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['outreach', leadId],
    queryFn: () => getOutreach(leadId),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateOutreach({
        lead_id: leadId,
        channels: ['email', 'whatsapp', 'linkedin', 'cold_call_script'],
        tone: selectedTone as 'professional' | 'casual' | 'urgent',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach', leadId] });
      toast({ title: 'Outreach generated', description: '4 personalized messages are ready.' });
    },
    onError: () => toast({ title: 'Generation failed', variant: 'destructive' }),
  });

  const markSentMutation = useMutation({
    mutationFn: (id: string) => updateOutreach(id, { status: 'sent' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outreach', leadId] }),
  });

  async function copyToClipboard(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard' });
  }

  const messages = data?.messages ?? [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {TONE_OPTIONS.map(t => (
            <Button
              key={t.value}
              variant={selectedTone === t.value ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedTone(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="gap-1.5 ml-auto"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Zap className="h-3.5 w-3.5" />
          }
          Generate All
        </Button>
      </div>

      {/* Messages */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      )}

      {!isLoading && messages.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Click Generate All to create personalized outreach.
          </CardContent>
        </Card>
      )}

      {messages.map((msg: {
        id: string;
        channel: string;
        subject?: string;
        body: string;
        status: string;
      }) => (
        <Card key={msg.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{CHANNEL_LABELS[msg.channel] ?? msg.channel}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{msg.status}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(msg.id, msg.body)}
                  aria-label="Copy to clipboard"
                >
                  {copiedId === msg.id
                    ? <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                    : <Copy className="h-3.5 w-3.5" />
                  }
                </Button>
                {msg.status === 'draft' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => markSentMutation.mutate(msg.id)}
                    aria-label="Mark as sent"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardTitle>
            {msg.subject && (
              <p className="text-xs font-medium text-muted-foreground mt-1">Subject: {msg.subject}</p>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {msg.body}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
