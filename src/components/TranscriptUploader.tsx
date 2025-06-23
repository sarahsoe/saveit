import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_SIZE_MB = 5000; // Supabase Storage supports up to 5GB
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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [cost, setCost] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Unsupported file type.');
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError('File too large (max 5GB).');
      setFile(null);
      return;
    }
    setFile(f);
    setError('');
    setCost(Math.round((f.size / (1024 * 1024 * 0.5)) * 0.006 * 1000) / 1000); // rough estimate
  }

  async function uploadToSupabase(file: File): Promise<string> {
    setProgress('Uploading to Supabase...');
    setUploadProgress(0);
    const filePath = `uploads/${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabase.storage
      .from('audio-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
        onUploadProgress: (event: ProgressEvent) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        }
      } as any); // onUploadProgress is not typed in supabase-js yet
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    // Get public URL
    const { data: publicUrlData } = supabase.storage.from('audio-uploads').getPublicUrl(filePath);
    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to get public URL from Supabase');
    }
    return publicUrlData.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setProgress('');
    setUploadProgress(0);
    try {
      let res: Response | undefined;
      if (tab === 'youtube') {
        setProgress('Processing...');
        res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl })
        });
      } else if (file) {
        // 1. Upload to Supabase Storage
        setProgress('Uploading to Supabase...');
        const publicUrl = await uploadToSupabase(file);
        setProgress('Processing...');
        // 2. Send public URL to API
        res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl: publicUrl, fileName: file.name })
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
            <div className="text-xs text-gray-500 mb-2">
              Max file size: 5GB. Files are uploaded to secure cloud storage before processing.
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        )}
        {/* Status and Error Messages */}
        <div className="mb-2 min-h-[24px]">
          {error && (
            <div className="text-red-600 bg-red-100 dark:bg-red-900/40 rounded px-2 py-1 text-sm">
              {error}
            </div>
          )}
          {!error && progress && (
            <div className="text-blue-700 bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-1 text-sm">
              {progress}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={progress === 'Processing...' || (tab === 'file' && !file)}
        >
          {progress === 'Processing...' ? 'Processing...' : 'Transcribe'}
        </button>
      </form>
    </div>
  );
} 