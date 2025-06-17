'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Clock, DollarSign, FileText, Trash2, Copy, Download } from 'lucide-react';
import { TranscriptionData } from '@/types';
import { formatDate, formatCost } from '@/lib/utils';

interface TranscriptionCardProps {
  transcription: TranscriptionData;
  onDelete: (id: string) => void;
}

export default function TranscriptionCard({ transcription, onDelete }: TranscriptionCardProps) {
  const handleCopy = async () => {
    if (transcription.cleaned_transcript) {
      await navigator.clipboard.writeText(transcription.cleaned_transcript);
      // TODO: Add toast notification
    }
  };

  const handleDownload = () => {
    if (transcription.cleaned_transcript) {
      const blob = new Blob([transcription.cleaned_transcript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${transcription.video_title || 'transcript'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card className="shadow-md border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur transition-all hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1">
              {transcription.video_title || 'Untitled Video'}
            </CardTitle>
            <CardDescription className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {transcription.created_at && formatDate(transcription.created_at)}
              </span>
              {transcription.cost && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCost(transcription.cost)}
                </span>
              )}
              {transcription.output_tokens && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {transcription.output_tokens} tokens
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-slate-500 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => transcription.id && onDelete(transcription.id)}
              className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
            {transcription.video_url}
          </div>
          {transcription.cleaned_transcript && (
            <Textarea
              value={transcription.cleaned_transcript}
              readOnly
              className="min-h-[100px] resize-none border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
} 