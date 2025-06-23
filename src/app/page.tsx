'use client';

import { useState, useEffect } from 'react';
import TranscriptionForm from '@/components/TranscriptionForm';
import TranscriptionList from '@/components/TranscriptionList';
import { TranscriptionData } from '@/types';
import TranscriptUploader from '@/components/TranscriptUploader';

export default function HomePage() {
  const [transcriptions, setTranscriptions] = useState<TranscriptionData[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [error, setError] = useState('');

  // Load transcriptions on mount
  useEffect(() => {
    loadTranscriptions();
  }, []);

  const loadTranscriptions = async () => {
    try {
      const response = await fetch('/api/transcriptions');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setTranscriptions(data.data);
      } else {
        console.error('API did not return array:', data);
        setTranscriptions([]);
      }
    } catch (error) {
      console.error('Failed to load transcriptions:', error);
      setTranscriptions([]);
    }
  };

  function handleTranscription(data: any) {
    setSelected(data);
    setTranscriptions([data, ...transcriptions]);
    setError('');
  }

  function handleClose() {
    setSelected(null);
  }

  // Defensive log before rendering the list
  console.log('HomePage transcriptions state:', transcriptions, typeof transcriptions, Array.isArray(transcriptions));

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          SaveIt
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Transcribe YouTube videos or upload audio files for instant, clean transcripts
        </p>
      </div>

      {/* Transcription Form */}
      <div className="mb-8">
        <TranscriptUploader onTranscription={handleTranscription} />
      </div>

      {selected && (
        <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg shadow">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">Transcription Result</h2>
            <button onClick={handleClose} className="text-sm text-blue-600">Close</button>
          </div>
          <div className="mb-2 text-sm text-gray-700 dark:text-gray-200">
            <b>Title:</b> {selected.video_title || selected.file_name}<br/>
            <b>Source:</b> {selected.processing_method}<br/>
            <b>Cost:</b> ${selected.cost?.toFixed(3)}
          </div>
          <div className="mb-2">
            <b>Summary:</b>
            <div className="whitespace-pre-line text-gray-800 dark:text-gray-100 text-base mt-1">
              {selected.summary}
            </div>
          </div>
          <div>
            <b>Transcript:</b>
            <div className="whitespace-pre-line text-gray-800 dark:text-gray-100 text-sm mt-1 max-h-64 overflow-y-auto">
              {selected.cleaned_transcript || selected.raw_transcript}
            </div>
          </div>
        </div>
      )}

      {/* Transcriptions List - WITH BULLETPROOF GUARDS */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Recent Transcriptions</h2>
        {Array.isArray(transcriptions) && transcriptions.length > 0 ? (
          <TranscriptionList transcriptions={transcriptions} onDelete={loadTranscriptions} />
        ) : (
          <div>No transcriptions yet.</div>
        )}
      </div>
    </div>
  );
}
