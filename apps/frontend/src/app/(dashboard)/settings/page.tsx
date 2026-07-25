'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');

  function handleSave() {
    // In production this would call an API endpoint to store keys securely
    toast({ title: 'Settings saved', description: 'Your configuration has been updated.' });
  }

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your ProspectAI workspace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Configuration</CardTitle>
          <CardDescription>Set up your AI provider for research, scoring, and outreach generation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <Badge variant="secondary" className="text-xs">Required</Badge>
            </div>
            <Input
              id="openai-key"
              type="password"
              placeholder="sk-proj-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used for company research, lead scoring, outreach generation, and proposal drafting.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Discovery</CardTitle>
          <CardDescription>Configure how businesses are discovered and sourced.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="google-key">Google Places API Key</Label>
              <Badge variant="warning" className="text-xs">Recommended</Badge>
            </div>
            <Input
              id="google-key"
              type="password"
              placeholder="AIza..."
              value={googleKey}
              onChange={e => setGoogleKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enables real-time business search. Without this, only your existing database is searched.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="text-sm font-medium">Plan</p>
              <p className="text-xs text-muted-foreground">Current subscription</p>
            </div>
            <Badge>Pro</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Default Currency</p>
              <p className="text-xs text-muted-foreground">Used in proposals and analytics</p>
            </div>
            <Badge variant="secondary">KES</Badge>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full sm:w-auto">
        Save Settings
      </Button>
    </div>
  );
}
