'use client';

import { useState, useEffect } from 'react';
import TranscriptionForm from '@/components/TranscriptionForm';
import TranscriptionList from '@/components/TranscriptionList';
import { TranscriptionData } from '@/types';

export default function HomePage() {
  const [transcriptions, setTranscriptions] = useState<TranscriptionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load transcriptions on mount
  useEffect(() => {
    loadTranscriptions();
  }, []);

  const loadTranscriptions = async () => {
    try {
      // TODO: Replace with real API call
      // const response = await fetch('/api/transcriptions');
      // const data = await response.json();
      // setTranscriptions(data.transcriptions);
      
      // Mock data for now
      setTranscriptions([]);
    } catch (error) {
      console.error('Failed to load transcriptions:', error);
    }
  };

  const handleTranscribe = async (videoUrl: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      const result = await response.json();
      
      if (result.success && result.data) {
        setTranscriptions([result.data, ...transcriptions]);
      } else {
        console.error('Transcription failed:', result.error);
        // TODO: Show error toast
      }
    } catch (error) {
      console.error('Failed to transcribe:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // TODO: Add API call to delete from database
      // await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
      
      setTranscriptions(transcriptions.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete transcription:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          SaveIt
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Transform any video into clean, searchable transcripts
        </p>
      </div>

      {/* Transcription Form */}
      <div className="mb-8">
        <TranscriptionForm onTranscribe={handleTranscribe} isLoading={isLoading} />
      </div>

      {/* Transcriptions List */}
      <TranscriptionList transcriptions={transcriptions} onDelete={handleDelete} />
    </div>
  );
}
