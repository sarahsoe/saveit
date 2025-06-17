'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { TranscriptionData } from '@/types';
import TranscriptionCard from './TranscriptionCard';

interface TranscriptionListProps {
  transcriptions: TranscriptionData[];
  onDelete: (id: string) => void;
}

export default function TranscriptionList({ transcriptions, onDelete }: TranscriptionListProps) {
  if (transcriptions.length === 0) {
    return (
      <Card className="text-center py-12 bg-white/50 dark:bg-slate-800/50 backdrop-blur border-dashed">
        <CardContent>
          <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No transcriptions yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Add your first video URL above to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Your Transcriptions
        </h2>
        <Badge variant="secondary" className="px-3 py-1">
          {transcriptions.length} saved
        </Badge>
      </div>

      <div className="space-y-4">
        {transcriptions.map((transcription) => (
          <TranscriptionCard
            key={transcription.id}
            transcription={transcription}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
} 