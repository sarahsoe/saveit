#!/usr/bin/env python3
import sys
import json
import re

try:
    from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
except ImportError:
    print(json.dumps({"success": False, "error": "youtube-transcript-api not installed"}))
    sys.exit(1)

def extract_video_id(url_or_id):
    # Accepts full URL or just the ID
    url_or_id = url_or_id.strip()
    # If it's already an 11-char ID
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    # Try to extract from URL
    patterns = [
        r'(?:v=|youtu\.be/|embed/|v/|shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No video URL or ID provided"}))
        return
    url = sys.argv[1]
    video_id = extract_video_id(url)
    if not video_id:
        print(json.dumps({"success": False, "error": "Invalid YouTube URL or ID"}))
        return
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        text = ' '.join([x['text'] for x in transcript])
        print(json.dumps({
            "success": True,
            "transcript": text,
            "method": "youtube-transcript-api"
        }))
    except TranscriptsDisabled:
        print(json.dumps({"success": False, "error": "Transcript is disabled on this video"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main() 