#!/bin/bash

echo "🔍 DIAGNOSTIC CHECKS FOR WHISPER INTEGRATION"
echo "=============================================="

echo ""
echo "1. 📂 CHECKING FILE STRUCTURE..."
echo "   API Route exists: $([ -f "src/app/api/transcribe/route.ts" ] && echo "✅ YES" || echo "❌ NO")"
echo "   Python helper exists: $([ -f "src/lib/python-transcript.ts" ] && echo "✅ YES" || echo "❌ NO")"
echo "   Whisper helper exists: $([ -f "src/lib/whisper-transcript.ts" ] && echo "✅ YES" || echo "❌ NO")"
echo "   Temp directory exists: $([ -d "temp" ] && echo "✅ YES" || echo "❌ NO")"

echo ""
echo "2. 🔑 CHECKING ENVIRONMENT VARIABLES..."
echo "   OPENAI_API_KEY: $([ -n "$OPENAI_API_KEY" ] && echo "✅ SET" || echo "❌ NOT SET")"
echo "   ANTHROPIC_API_KEY: $([ -n "$ANTHROPIC_API_KEY" ] && echo "✅ SET" || echo "❌ NOT SET")"

echo ""
echo "3. 🐍 CHECKING PYTHON DEPENDENCIES..."
echo "   Python3 available: $(command -v python3 >/dev/null 2>&1 && echo "✅ YES" || echo "❌ NO")"
echo "   yt-dlp available: $(command -v yt-dlp >/dev/null 2>&1 && echo "✅ YES" || echo "❌ NO")"

if command -v python3 >/dev/null 2>&1; then
  echo "   youtube-transcript-api: $(python3 -c "import youtube_transcript_api; print('✅ INSTALLED')" 2>/dev/null || echo "❌ NOT INSTALLED")"
  echo "   yt-dlp python module: $(python3 -c "import yt_dlp; print('✅ INSTALLED')" 2>/dev/null || echo "❌ NOT INSTALLED")"
fi

echo ""
echo "4. 📦 CHECKING NODE.JS DEPENDENCIES..."
echo "   openai package: $(npm list openai >/dev/null 2>&1 && echo "✅ INSTALLED" || echo "❌ NOT INSTALLED")"

echo ""
echo "5. 🧪 TESTING YT-DLP FUNCTIONALITY..."
if command -v yt-dlp >/dev/null 2>&1; then
  echo "   Testing yt-dlp with sample video..."
  yt-dlp --print "%(title)s" "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>/dev/null && echo "   ✅ yt-dlp works!" || echo "   ❌ yt-dlp failed"
else
  echo "   ❌ yt-dlp not available"
fi

echo ""
echo "6. 📝 QUICK FIXES FOR COMMON ISSUES:"
echo ""
echo "   If yt-dlp not available:"
echo "   → pip install yt-dlp"
echo ""
echo "   If Python modules missing:"
echo "   → pip install youtube-transcript-api yt-dlp"
echo ""
echo "   If OpenAI not installed:"
echo "   → npm install openai"
echo ""
echo "   If temp directory missing:"
echo "   → mkdir temp"
echo ""
echo "   If environment variables missing:"
echo "   → Add to .env.local:"
echo "     OPENAI_API_KEY=your_key_here" 