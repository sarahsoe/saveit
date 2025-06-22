// src/lib/enhanced-nodejs-transcript.ts

// Enhanced Node.js transcript extraction methods for Vercel compatibility

// TIER 1: Enhanced Node.js Methods (youtube-transcript, multiple languages)
export async function tryEnhancedNodeMethods(videoId: string) {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    // Try default
    try {
      const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
      const transcript = transcriptArray.map(item => item.text).join(' ');
      if (transcript && transcript.length > 50) {
        return { success: true, transcript, title: null, source: 'youtube_transcript_default' };
      }
    } catch (error) {
      // Continue to next method
    }
    // Try multiple language codes
    const languages = ['en', 'en-US', 'en-GB', 'auto'];
    for (const lang of languages) {
      try {
        const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        const transcript = transcriptArray.map(item => item.text).join(' ');
        if (transcript && transcript.length > 50) {
          return { success: true, transcript, title: null, source: `youtube_transcript_${lang}` };
        }
      } catch (langError) {
        // Try next language
      }
    }
    return { success: false, error: 'No transcript found with Node.js methods', source: 'youtube_transcript' };
  } catch (error) {
    return { success: false, error: `Node.js transcript library failed: ${error}`, source: 'youtube_transcript' };
  }
}

// TIER 2: youtube-dl-exec Subtitles
export async function tryYoutubeDlExec(videoUrl: string) {
  try {
    const youtubeDl = await import('youtube-dl-exec');
    const info = await youtubeDl.default(videoUrl, {
      dumpJson: true,
      writeAutoSub: true,
      subLang: 'en',
      skipDownload: true
    });
    const infoAny = info as any;
    if (infoAny.requested_subtitles && infoAny.requested_subtitles.en) {
      const subUrl = infoAny.requested_subtitles.en.url;
      const response = await fetch(subUrl);
      const subContent = await response.text();
      const transcript = parseSubtitleContent(subContent);
      if (transcript && transcript.length > 50) {
        return {
          success: true,
          transcript,
          title: infoAny.title || 'YouTube Video',
          source: 'youtubedl_subtitles'
        };
      }
    }
    return { success: false, error: 'No subtitles found via youtube-dl-exec', source: 'youtubedl_subtitles' };
  } catch (error) {
    return { success: false, error: `youtube-dl-exec failed: ${error}`, source: 'youtubedl_subtitles' };
  }
}

function parseSubtitleContent(content: string): string {
  try {
    const lines = content.split('\n');
    const textLines = lines.filter(line => {
      return line.trim() &&
        !line.includes('-->') &&
        !line.match(/^\d+$/) &&
        !line.startsWith('WEBVTT') &&
        !line.startsWith('NOTE');
    });
    return textLines.join(' ').trim();
  } catch (error) {
    return '';
  }
} 