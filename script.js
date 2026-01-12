const musicTracks = [];

const API_BASE = 'http://localhost:5000/api';

let currentTrackIndex = 0;
let currentTrack = null;
let isPlaying = false;
let isShuffled = false;
let isRepeated = false;
let currentVolume = 70;
let currentView = 'home';
let searchResults = [];
let likedTracks = [];
let allTracks = [...musicTracks];

const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('play-pause');
const prevBtn = document.querySelector('.prev-btn');
const nextBtn = document.querySelector('.next-btn');
const shuffleBtn = document.querySelector('.shuffle-btn');
const repeatBtn = document.querySelector('.repeat-btn');
const progressSlider = document.getElementById('progress-slider');
const progressFill = document.getElementById('progress-fill');
const volumeSlider = document.getElementById('volume-slider');
const volumeBtn = document.querySelector('.volume-btn');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const currentTrackImg = document.getElementById('current-track-img');
const currentTrackTitle = document.getElementById('current-track-title');
const currentTrackArtist = document.getElementById('current-track-artist');
const trackImage = document.querySelector('.track-image');

async function init() {
    await loadLikedSongs();
    if (allTracks.length > 0) {
        loadTrack(currentTrackIndex);
    } else {
        const trackImage = document.getElementById('player-track-image');
        const trackDetails = document.getElementById('player-track-details');
        const likeBtn = document.getElementById('player-like-btn');
        const placeholder = document.getElementById('player-placeholder');
        
        if (trackImage) trackImage.style.display = 'none';
        if (trackDetails) trackDetails.style.display = 'none';
        if (likeBtn) likeBtn.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }
    setupEventListeners();
    updateUI();
    setupNavigation();
}

function loadTrack(index, trackList = allTracks) {
    if (index < 0 || index >= trackList.length) return;
    
    currentTrackIndex = index;
    const track = trackList[index];
    currentTrack = track;
    
    let audioUrl = track.audio;
    if (audioUrl && audioUrl.startsWith('/api/stream')) {
        audioUrl = `http://localhost:5000${audioUrl}`;
    } else if (track.id && (!audioUrl || audioUrl.includes('soundhelix'))) {
        audioUrl = `http://localhost:5000/api/stream/${track.id}`;
    }
    
    audioPlayer.onerror = function(e) {
        alert('Failed to play audio. Make sure the Python server is running and try again.');
    };
    
    audioPlayer.onloadeddata = function() {
    };
    
    audioPlayer.src = audioUrl;
    currentTrackImg.src = track.image;
    currentTrackTitle.textContent = track.title;
    currentTrackArtist.textContent = track.artist;
    
    const trackImage = document.getElementById('player-track-image');
    const trackDetails = document.getElementById('player-track-details');
    const likeBtn = document.getElementById('player-like-btn');
    const placeholder = document.getElementById('player-placeholder');
    
    if (trackImage) trackImage.style.display = 'flex';
    if (trackDetails) trackDetails.style.display = 'block';
    if (likeBtn) likeBtn.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    
    updateAllCards();
    
    timeTotal.textContent = formatTime(track.duration);
    
    progressSlider.value = 0;
    progressFill.style.width = '0%';
    timeCurrent.textContent = '0:00';
    
    updateLikeButton();
    
    audioPlayer.addEventListener('loadedmetadata', () => {
        timeTotal.textContent = formatTime(audioPlayer.duration || track.duration);
    }, { once: true });
}

function updateAllCards() {
    const trackList = getCurrentTrackList();
    const currentTrackId = currentTrack ? (currentTrack.id || currentTrack.title) : null;
    
    document.querySelectorAll('.music-card').forEach((card) => {
        const cardTrackIndex = parseInt(card.getAttribute('data-track'));
        const cardTrack = trackList[cardTrackIndex];
        const cardTrackId = cardTrack ? (cardTrack.id || cardTrack.title) : null;
        
        if (cardTrackId === currentTrackId) {
            card.style.border = '2px solid #1db954';
            card.style.boxShadow = '0 8px 32px rgba(29, 185, 84, 0.3)';
        } else {
            card.style.border = '1px solid var(--border-color)';
            card.style.boxShadow = 'none';
        }
    });
    
    document.querySelectorAll('.list-item').forEach((item, index) => {
        if (index === currentTrackIndex && trackList === allTracks) {
            item.style.background = 'rgba(29, 185, 84, 0.1)';
        } else {
            item.style.background = 'transparent';
        }
    });
}

function setupEventListeners() {
    playPauseBtn.addEventListener('click', togglePlayPause);
    
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    
    progressSlider.addEventListener('input', seek);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleTrackEnd);
    
    volumeSlider.addEventListener('input', changeVolume);
    volumeBtn.addEventListener('click', toggleMute);
    
    const playerLikeBtn = document.getElementById('player-like-btn');
    if (playerLikeBtn) {
        playerLikeBtn.addEventListener('click', async () => {
            if (currentTrack) {
                await toggleLike(currentTrack);
            }
        });
    }
    
    const homeSearchInput = document.getElementById('home-search-input');
    const navSearchInput = document.getElementById('nav-search-input');
    const navSearchContainer = document.getElementById('nav-search-container');
    const navSearchClose = document.getElementById('nav-search-close');
    let searchTimeout;
    
    function handleSearchInput(input, query) {
        clearTimeout(searchTimeout);
        if (query.length > 2) {
            searchTimeout = setTimeout(() => performSearch(query), 500);
        } else if (query.length === 0) {
            showHomeView();
        }
    }
    
    function handleSearchEnter(input) {
        const query = input.value.trim();
        if (query) {
            performSearch(query);
        }
    }
    
    if (homeSearchInput) {
        homeSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            handleSearchInput(homeSearchInput, query);
            if (navSearchInput) navSearchInput.value = query;
        });
        
        homeSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearchEnter(homeSearchInput);
            }
        });
    }
    
    if (navSearchInput) {
        navSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            handleSearchInput(navSearchInput, query);
            if (homeSearchInput) homeSearchInput.value = query;
        });
        
        navSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearchEnter(navSearchInput);
            }
        });
    }
    
    if (navSearchClose) {
        navSearchClose.addEventListener('click', () => {
            if (navSearchInput) navSearchInput.value = '';
            if (homeSearchInput) homeSearchInput.value = '';
            showHomeView();
        });
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const likedNav = document.getElementById('liked-nav');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            
            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');
            
            if (view === 'home') {
                showHomeView();
            } else if (view === 'liked') {
                showLikedView();
            }
        });
    });
}

function togglePlayPause() {
    if (isPlaying) {
        pauseTrack();
    } else {
        playTrack();
    }
}

function playTrack(index = currentTrackIndex, trackList = allTracks) {
    if (index !== currentTrackIndex || currentTrack !== trackList[index]) {
        loadTrack(index, trackList);
    }
    
    setTimeout(() => {
        audioPlayer.play().then(() => {
            isPlaying = true;
            updateUI();
            trackImage.classList.add('playing');
        }).catch(error => {
            if (currentTrack && currentTrack.id) {
                const streamUrl = `http://localhost:5000/api/stream/${currentTrack.id}`;
                audioPlayer.src = streamUrl;
                audioPlayer.load();
                
                setTimeout(() => {
                    audioPlayer.play().then(() => {
                        isPlaying = true;
                        updateUI();
                        trackImage.classList.add('playing');
                    }).catch(err => {
                        alert('Unable to play this track. The video may be unavailable or restricted. Check the Python server console for errors.');
                    });
                }, 1000);
            } else {
                alert('Unable to play this track. Missing track information.');
            }
        });
    }, 500);
}

function pauseTrack() {
    audioPlayer.pause();
    isPlaying = false;
    updateUI();
    trackImage.classList.remove('playing');
}

function getCurrentTrackList() {
    if (currentView === 'search') return searchResults;
    if (currentView === 'liked') return likedTracks;
    return allTracks;
}

function playPrevious() {
    const trackList = getCurrentTrackList();
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) {
        newIndex = trackList.length - 1;
    }
    playTrack(newIndex, trackList);
}

function playNext() {
    const trackList = getCurrentTrackList();
    let newIndex;
    if (isShuffled) {
        newIndex = Math.floor(Math.random() * trackList.length);
        while (newIndex === currentTrackIndex && trackList.length > 1) {
            newIndex = Math.floor(Math.random() * trackList.length);
        }
    } else {
        newIndex = currentTrackIndex + 1;
        if (newIndex >= trackList.length) {
            newIndex = 0;
        }
    }
    playTrack(newIndex, trackList);
}

function handleTrackEnd() {
    if (isRepeated) {
        playTrack(currentTrackIndex);
    } else {
        playNext();
    }
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    if (isShuffled) {
        shuffleBtn.classList.add('active');
    } else {
        shuffleBtn.classList.remove('active');
    }
}

function toggleRepeat() {
    isRepeated = !isRepeated;
    if (isRepeated) {
        repeatBtn.classList.add('active');
    } else {
        repeatBtn.classList.remove('active');
    }
}

function seek() {
    const progress = progressSlider.value;
    const time = (progress / 100) * audioPlayer.duration;
    audioPlayer.currentTime = time;
    progressFill.style.width = progress + '%';
    timeCurrent.textContent = formatTime(time);
}

function updateProgress() {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressSlider.value = progress;
        progressFill.style.width = progress + '%';
        timeCurrent.textContent = formatTime(audioPlayer.currentTime);
    }
}

function changeVolume() {
    currentVolume = volumeSlider.value;
    audioPlayer.volume = currentVolume / 100;
    updateVolumeIcon();
}

function toggleMute() {
    if (audioPlayer.volume > 0) {
        audioPlayer.volume = 0;
        volumeSlider.value = 0;
        currentVolume = 0;
    } else {
        audioPlayer.volume = currentVolume / 100 || 0.7;
        volumeSlider.value = currentVolume || 70;
    }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const volume = audioPlayer.volume;
    const volumeIcon = volumeBtn.querySelector('i');
    if (volumeIcon) {
        if (volume === 0) {
            volumeIcon.className = 'fas fa-volume-mute';
        } else if (volume < 0.5) {
            volumeIcon.className = 'fas fa-volume-down';
        } else {
            volumeIcon.className = 'fas fa-volume-up';
        }
    }
}

function updateUI() {
    const playIcon = playPauseBtn.querySelector('i');
    if (playIcon) {
        playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
    updateAllCards();
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function performSearch(query) {
    try {
        currentView = 'search';
        
        const navSearchContainer = document.getElementById('nav-search-container');
        const navSearchInput = document.getElementById('nav-search-input');
        const homeSearchInput = document.getElementById('home-search-input');
        
        if (navSearchContainer) {
            navSearchContainer.style.display = 'flex';
            navSearchContainer.style.visibility = 'visible';
        }
        if (navSearchInput && homeSearchInput) {
            navSearchInput.value = homeSearchInput.value || query;
        }
        
        showSearchView();
        
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.tracks) {
            searchResults = data.tracks;
            displaySearchResults(searchResults);
        } else {
            document.getElementById('search-grid').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">No results found</p>';
        }
    } catch (error) {
        document.getElementById('search-grid').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Search unavailable. Make sure the Python server is running.</p>';
    }
}

function displaySearchResults(tracks) {
    const grid = document.getElementById('search-grid');
    grid.innerHTML = '';
    
    tracks.forEach((track, index) => {
        const card = createMusicCard(track, index, searchResults);
        grid.appendChild(card);
    });
}

function displayLikedSongs() {
    const grid = document.getElementById('liked-grid');
    grid.innerHTML = '';
    
    if (likedTracks.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">No liked songs yet</p>';
        return;
    }
    
    likedTracks.forEach((track, index) => {
        const card = createMusicCard(track, index, likedTracks);
        grid.appendChild(card);
    });
}

function createMusicCard(track, index, trackList) {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.setAttribute('data-track', index);
    
    card.innerHTML = `
        <div class="card-image">
            <img src="${track.image}" alt="${track.title}" onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
            <div class="play-overlay">
                <button class="play-btn"><i class="fas fa-play"></i></button>
            </div>
        </div>
        <div class="card-info">
            <h3>${track.title}</h3>
            <p>${track.artist}</p>
        </div>
        <button class="like-btn-card" data-track-id="${track.id || index}">
            <i class="fas fa-heart"></i>
        </button>
    `;
    
    card.addEventListener('click', () => {
        currentView = trackList === searchResults ? 'search' : (trackList === likedTracks ? 'liked' : 'home');
        playTrack(index, trackList);
    });
    
    const playBtn = card.querySelector('.play-btn');
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentView = trackList === searchResults ? 'search' : (trackList === likedTracks ? 'liked' : 'home');
        playTrack(index, trackList);
    });
    
    const likeBtn = card.querySelector('.like-btn-card');
    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleLike(track);
    });
    
    checkAndUpdateLikeButton(likeBtn, track.id || index);
    
    return card;
}

function showHomeView() {
    currentView = 'home';
    const homeSection = document.getElementById('home-section');
    if (homeSection) homeSection.style.display = 'flex';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('liked-section').style.display = 'none';
    
    const navSearchContainer = document.getElementById('nav-search-container');
    if (navSearchContainer) navSearchContainer.style.display = 'none';
    
    const homeSearchInput = document.getElementById('home-search-input');
    const navSearchInput = document.getElementById('nav-search-input');
    if (homeSearchInput) {
        homeSearchInput.value = '';
        homeSearchInput.focus();
    }
    if (navSearchInput) navSearchInput.value = '';
}

function showSearchView() {
    currentView = 'search';
    const homeSection = document.getElementById('home-section');
    if (homeSection) homeSection.style.display = 'none';
    document.getElementById('search-results').style.display = 'block';
    document.getElementById('liked-section').style.display = 'none';
    
    const navSearchContainer = document.getElementById('nav-search-container');
    const navSearchInput = document.getElementById('nav-search-input');
    const homeSearchInput = document.getElementById('home-search-input');
    
    if (navSearchContainer) {
        navSearchContainer.style.display = 'flex';
        navSearchContainer.style.visibility = 'visible';
    }
    if (navSearchInput && homeSearchInput) {
        if (!navSearchInput.value) {
            navSearchInput.value = homeSearchInput.value;
        }
    }
}

function showLikedView() {
    currentView = 'liked';
    const homeSection = document.getElementById('home-section');
    if (homeSection) homeSection.style.display = 'none';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('liked-section').style.display = 'block';
    displayLikedSongs();
}

async function loadLikedSongs() {
    try {
        const response = await fetch(`${API_BASE}/liked`);
        const data = await response.json();
        if (data.tracks) {
            likedTracks = data.tracks;
        }
    } catch (error) {
    }
}

async function toggleLike(track) {
    try {
        const trackId = track.id || track.title;
        const isLiked = likedTracks.some(t => (t.id || t.title) === trackId);
        
        if (isLiked) {
            const response = await fetch(`${API_BASE}/liked/${trackId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                likedTracks = data.liked;
                if (currentView === 'liked') {
                    displayLikedSongs();
                }
            }
        } else {
            const response = await fetch(`${API_BASE}/liked`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ track: track })
            });
            const data = await response.json();
            if (data.success) {
                likedTracks = data.liked;
            }
        }
        
        updateLikeButton();
        updateAllLikeButtons();
    } catch (error) {
    }
}

function updateLikeButton() {
    if (!currentTrack) return;
    const trackId = currentTrack.id || currentTrack.title;
    const isLiked = likedTracks.some(t => (t.id || t.title) === trackId);
    
    const likeBtn = document.getElementById('player-like-btn');
    if (likeBtn) {
        const icon = likeBtn.querySelector('i');
        if (icon) {
            icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
            likeBtn.style.color = isLiked ? 'var(--primary-color)' : 'var(--text-secondary)';
        }
    }
}

function updateAllLikeButtons() {
    document.querySelectorAll('.like-btn-card').forEach(btn => {
        const trackId = btn.getAttribute('data-track-id');
        checkAndUpdateLikeButton(btn, trackId);
    });
}

function checkAndUpdateLikeButton(btn, trackId) {
    const isLiked = likedTracks.some(t => (t.id || t.title) === trackId);
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
        btn.style.color = isLiked ? 'var(--primary-color)' : 'var(--text-secondary)';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlayPause();
    }
    if (e.code === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        playPrevious();
    }
    if (e.code === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        playNext();
    }
});

document.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', function() {
        this.style.opacity = '1';
    });
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s ease';
});

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
        }
    });
}, observerOptions);

document.querySelectorAll('.music-card, .list-item').forEach(el => {
    observer.observe(el);
});

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
