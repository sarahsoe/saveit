'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Link2, Save } from 'lucide-react';

interface TranscriptionFormProps {
  onTranscribe: (url: string) => Promise<void>;
  isLoading: boolean;
}

export default function TranscriptionForm({ onTranscribe, isLoading }: TranscriptionFormProps) {
  const [videoUrl, setVideoUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    
    await onTranscribe(videoUrl);
    setVideoUrl('');
  };

  return (
    <Card className="shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Add New Video
        </CardTitle>
        <CardDescription>
          Paste any video URL to get started with transcription
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="flex-1 border-slate-300 dark:border-slate-600"
            disabled={isLoading}
          />
          <Button 
            type="submit"
            disabled={!videoUrl.trim() || isLoading}
            className="px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save & Transcribe
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 