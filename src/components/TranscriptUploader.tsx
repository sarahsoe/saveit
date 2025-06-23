import React, { useState } from 'react';

const MAX_SIZE_MB = 25;
const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a',
  'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm'
];

export default function TranscriptUploader({ onTranscription }: { onTranscription: (data: any) => void }) {
  const [tab, setTab] = useState<'youtube' | 'file'>('youtube');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [cost, setCost] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Unsupported file type.');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError('File too large (max 25MB).');
      return;
    }
    setFile(f);
    setError('');
    setCost(Math.round((f.size / (1024 * 1024 * 0.5)) * 0.006 * 1000) / 1000); // rough estimate
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setProgress('Processing...');
    try {
      let res: Response | undefined;
      if (tab === 'youtube') {
        res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl })
        });
      } else if (file) {
        const formData = new FormData();
        formData.append('audioFile', file);
        res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        });
      }
      if (!res) throw new Error('No input provided');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      setProgress('Success!');
      onTranscription(data.data);
    } catch (err: any) {
      setError(err.message);
      setProgress('');
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4 bg-white dark:bg-zinc-900 rounded-lg shadow">
      <div className="flex mb-4">
        <button className={`flex-1 py-2 ${tab === 'youtube' ? 'font-bold border-b-2 border-blue-500' : ''}`} onClick={() => setTab('youtube')}>YouTube</button>
        <button className={`flex-1 py-2 ${tab === 'file' ? 'font-bold border-b-2 border-blue-500' : ''}`} onClick={() => setTab('file')}>File Upload</button>
      </div>
      <form onSubmit={handleSubmit}>
        {tab === 'youtube' ? (
          <div>
            <input
              type="url"
              className="w-full p-2 border rounded mb-2"
              placeholder="Paste YouTube URL"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              required
            />
          </div>
        ) : (
          <div>
            <input
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileChange}
              className="mb-2"
            />
            {file && (
              <div className="mb-2 text-sm">
                <span>File: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                {cost !== null && <span className="ml-2">Estimated cost: ${cost.toFixed(3)}</span>}
              </div>
            )}
          </div>
        )}
        {error && <div className="text-red-500 mb-2">{error}</div>}
        {progress && <div className="text-blue-500 mb-2">{progress}</div>}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={progress === 'Processing...'}
        >
          {progress === 'Processing...' ? 'Processing...' : 'Transcribe'}
        </button>
      </form>
    </div>
  );
} 