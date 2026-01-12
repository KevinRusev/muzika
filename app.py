from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import requests

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

liked_songs = []
audio_url_cache = {}

@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Query parameter required'}), 400
    
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'default_search': 'ytsearch',
            'noplaylist': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                search_results = ydl.extract_info(f"ytsearch10:{query}", download=False)
            except Exception as search_error:
                search_results = ydl.extract_info(f"ytsearch5:{query}", download=False)
            
        tracks = []
        if 'entries' in search_results:
            for entry in search_results['entries']:
                if entry:
                    video_id = entry.get('id')
                    if video_id:
                        title = entry.get('title', 'Unknown')
                        artist = entry.get('uploader', 'Unknown Artist')
                        
                        if ' - ' in title:
                            parts = title.split(' - ', 1)
                            if len(parts) == 2:
                                title = parts[0].strip()
                                artist = parts[1].strip()
                        
                        image_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
                        
                        track = {
                            'id': video_id,
                            'title': title,
                            'artist': artist,
                            'image': image_url,
                            'audio': f'/api/stream/{video_id}',
                            'duration': entry.get('duration', 0)
                        }
                        tracks.append(track)
        
        return jsonify({'tracks': tracks})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/track/<video_id>', methods=['GET'])
def get_track(video_id):
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            video_info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        
        title = video_info.get('title', 'Unknown')
        artist = video_info.get('uploader', 'Unknown Artist')
        
        if ' - ' in title:
            parts = title.split(' - ', 1)
            if len(parts) == 2:
                title = parts[0].strip()
                artist = parts[1].strip()
        
        audio_url = video_info.get('url', '')
        if audio_url:
            audio_url_cache[video_id] = audio_url
            
        track = {
            'id': video_id,
            'title': title,
            'artist': artist,
            'image': f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
            'audio': f'/api/stream/{video_id}',
            'duration': video_info.get('duration', 0)
        }
        
        return jsonify(track)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stream/<video_id>', methods=['GET', 'OPTIONS'])
def stream_audio(video_id):
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Range')
        return response
    try:
        audio_url = audio_url_cache.get(video_id)
        
        if not audio_url:
            ydl_opts = {
                'format': 'bestaudio/best',
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                    video_info = ydl.extract_info(video_url, download=False)
                    
                    audio_url = video_info.get('url', '')
                    
                    if not audio_url:
                        formats = video_info.get('formats', [])
                        audio_formats = [f for f in formats if f.get('acodec') != 'none' and (f.get('vcodec') == 'none' or not f.get('vcodec'))]
                        if audio_formats:
                            best_audio = max(audio_formats, key=lambda x: x.get('abr', 0) or 0)
                            audio_url = best_audio.get('url', '')
                    
                    if audio_url:
                        audio_url_cache[video_id] = audio_url
            except Exception as e:
                try:
                    ydl_opts_alt = {
                        'format': 'bestaudio[ext=m4a]/bestaudio/best',
                        'quiet': True,
                        'no_warnings': True,
                        'noplaylist': True,
                        'skip_download': True,
                    }
                    with yt_dlp.YoutubeDL(ydl_opts_alt) as ydl:
                        video_info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                        formats = video_info.get('formats', [])
                        for fmt in sorted(formats, key=lambda x: x.get('abr', 0) or 0, reverse=True):
                            if fmt.get('acodec') != 'none':
                                audio_url = fmt.get('url', '')
                                if audio_url:
                                    audio_url_cache[video_id] = audio_url
                                    break
                except Exception as e3:
                    pass
        
        if not audio_url:
            return jsonify({'error': 'Audio URL not found. The video may be unavailable.'}), 404
        
        def generate():
            try:
                response = requests.get(audio_url, stream=True, timeout=30, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.youtube.com/',
                    'Accept': '*/*',
                    'Range': request.headers.get('Range', '')
                })
                response.raise_for_status()
                
                content_type_header = response.headers.get('Content-Type', 'audio/mpeg')
                
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
            except Exception as e:
                import traceback
                traceback.print_exc()
        
        content_type = 'audio/mpeg'
        try:
            if not audio_url_cache.get(video_id):
                pass
        except:
            pass
        
        return Response(
            stream_with_context(generate()),
            mimetype=content_type,
            headers={
                'Content-Type': content_type,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        response = jsonify({'error': str(e)})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.errorhandler(404)
def not_found(error):
    response = jsonify({'error': 'Route not found', 'path': request.path, 'method': request.method})
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response, 404

@app.route('/api/liked', methods=['GET'])
def get_liked():
    return jsonify({'tracks': liked_songs})

@app.route('/api/liked', methods=['POST'])
def add_liked():
    data = request.json
    track = data.get('track')
    if track and track not in liked_songs:
        liked_songs.append(track)
    return jsonify({'success': True, 'liked': liked_songs})

@app.route('/api/liked/<track_id>', methods=['DELETE'])
def remove_liked(track_id):
    global liked_songs
    liked_songs = [t for t in liked_songs if t.get('id') != track_id]
    return jsonify({'success': True, 'liked': liked_songs})

@app.route('/api/liked/<track_id>', methods=['GET'])
def is_liked(track_id):
    is_liked_track = any(t.get('id') == track_id for t in liked_songs)
    return jsonify({'liked': is_liked_track})

@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({'status': 'ok', 'message': 'Server is running'})

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
