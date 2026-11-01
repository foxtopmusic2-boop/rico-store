// Rico Store (ريكو ستور) - Streaming Player & Server Engine
const RicoPlayer = {
    currentMedia: null,
    currentServer: 'vidsrc',
    currentSeason: 1,
    currentEpisode: 1,
    isCinemaMode: false,

    // خوادم البث المباشر المتاحة
    servers: [
        {
            id: 'vidsrc',
            name: 'سيرفر VIP 1 (VidSrc Pro)',
            badge: '4K ULTRA',
            getUrl: (type, id, season = 1, episode = 1) => {
                if (type === 'movie') return `https://vidsrc.to/embed/movie/${id}`;
                return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
            }
        },
        {
            id: 'vidsrc_cc',
            name: 'سيرفر سريع 2 (VidSrc CC)',
            badge: '1080p HD',
            getUrl: (type, id, season = 1, episode = 1) => {
                if (type === 'movie') return `https://vidsrc.cc/v2/embed/movie/${id}`;
                return `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
            }
        },
        {
            id: 'autoembed',
            name: 'سيرفر عالمي 3 (AutoEmbed)',
            badge: 'متعدد اللغات',
            getUrl: (type, id, season = 1, episode = 1) => {
                if (type === 'movie') return `https://player.autoembed.cc/embed/movie/${id}`;
                return `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`;
            }
        },
        {
            id: 'superembed',
            name: 'سيرفر احتياطي 4 (SuperEmbed)',
            badge: 'بدون إعلانات',
            getUrl: (type, id, season = 1, episode = 1) => {
                if (type === 'movie') return `https://multiembed.mov/?video_id=${id}&tmdb=1`;
                return `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`;
            }
        },
        {
            id: 'rico_native',
            name: 'مشغل ريكو ستور المدمج (Demo Player)',
            badge: 'HTML5 سريع',
            getUrl: () => 'NATIVE_PLAYER'
        }
    ],

    // تهيئة المشغل
    init() {
        this.playerContainer = document.getElementById('videoPlayerWrapper');
        this.iframe = document.getElementById('streamingIframe');
        this.nativeVideo = document.getElementById('nativeVideoPlayer');
        this.serverSelector = document.getElementById('serverSelector');
        this.seasonSelector = document.getElementById('seasonSelector');
        this.episodesList = document.getElementById('episodesList');
        this.cinemaOverlay = document.getElementById('cinemaOverlay');

        this.setupEventListeners();
    },

    setupEventListeners() {
        // زر إغلاق وضع السينما
        if (this.cinemaOverlay) {
            this.cinemaOverlay.addEventListener('click', () => this.toggleCinemaMode(false));
        }

        // أزرار التحكم في الشاشة والسينما
        const cinemaBtn = document.getElementById('cinemaModeBtn');
        if (cinemaBtn) {
            cinemaBtn.addEventListener('click', () => this.toggleCinemaMode());
        }

        const fullscreenBtn = document.getElementById('playerFullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        const prevEpBtn = document.getElementById('prevEpisodeBtn');
        if (prevEpBtn) {
            prevEpBtn.addEventListener('click', () => this.changeEpisode(-1));
        }

        const nextEpBtn = document.getElementById('nextEpisodeBtn');
        if (nextEpBtn) {
            nextEpBtn.addEventListener('click', () => this.changeEpisode(1));
        }
    },

    // تشغيل عمل محدد
    async loadMedia(media, season = 1, episode = 1) {
        this.currentMedia = media;
        this.currentSeason = Number(season);
        this.currentEpisode = Number(episode);

        // حفظ في سجل المشاهدة (History)
        this.saveToHistory(media, this.currentSeason, this.currentEpisode);

        // إنشاء أزرار السيرفرات
        this.renderServerButtons();

        // معالجة اختيار المواسم والحلقات للمسلسلات
        const tvEpisodeControls = document.getElementById('tvEpisodeControls');
        const episodesSection = document.getElementById('episodesSection');

        if (media.type === 'tv') {
            if (tvEpisodeControls) tvEpisodeControls.classList.remove('hidden');
            if (episodesSection) episodesSection.classList.remove('hidden');
            await this.setupTVSeasons(media);
        } else {
            if (tvEpisodeControls) tvEpisodeControls.classList.add('hidden');
            if (episodesSection) episodesSection.classList.add('hidden');
        }

        // تحديث نص الحلقة الحالية
        this.updateEpisodeBadges();

        // تشغيل البث
        this.switchServer(this.currentServer);
    },

    // عرض أزرار السيرفرات
    renderServerButtons() {
        if (!this.serverSelector) return;
        this.serverSelector.innerHTML = '';

        this.servers.forEach((srv) => {
            const btn = document.createElement('button');
            const isActive = srv.id === this.currentServer;
            btn.className = `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition border ${
                isActive
                    ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30'
                    : 'bg-gray-900/80 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white'
            }`;
            btn.innerHTML = `
                <i class="fa-solid fa-server text-xs"></i>
                <span>${srv.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-400 font-mono">${srv.badge}</span>
            `;
            btn.addEventListener('click', () => this.switchServer(srv.id));
            this.serverSelector.appendChild(btn);
        });
    },

    // التبديل بين السيرفرات
    switchServer(serverId) {
        this.currentServer = serverId;
        const server = this.servers.find(s => s.id === serverId) || this.servers[0];
        this.renderServerButtons();

        if (server.id === 'rico_native') {
            // المشغل المحلي المدمج
            if (this.iframe) this.iframe.classList.add('hidden');
            if (this.nativeVideo) {
                this.nativeVideo.classList.remove('hidden');
                this.nativeVideo.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
                this.nativeVideo.play().catch(() => {});
            }
        } else {
            // مشغل السيرفر الخارجي عبر Iframe
            if (this.nativeVideo) {
                this.nativeVideo.pause();
                this.nativeVideo.classList.add('hidden');
            }
            if (this.iframe) {
                this.iframe.classList.remove('hidden');
                const streamUrl = server.getUrl(
                    this.currentMedia.type,
                    this.currentMedia.id,
                    this.currentSeason,
                    this.currentEpisode
                );
                this.iframe.src = streamUrl;
            }
        }

        // إشعار رقيق
        if (window.RicoApp && window.RicoApp.showToast) {
            window.RicoApp.showToast(`تم التبديل إلى: ${server.name}`);
        }
    },

    // إعداد واختيار المواسم والحلقات
    async setupTVSeasons(media) {
        if (!this.seasonSelector) return;
        this.seasonSelector.innerHTML = '';

        const seasons = media.seasons?.filter(s => s.season_number > 0) || [];
        const seasonCount = seasons.length > 0 ? seasons.length : (media.numberOfSeasons || 1);

        for (let i = 1; i <= seasonCount; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `الموسم ${i}`;
            if (i === this.currentSeason) opt.selected = true;
            this.seasonSelector.appendChild(opt);
        }

        this.seasonSelector.onchange = (e) => {
            this.currentSeason = Number(e.target.value);
            this.currentEpisode = 1;
            this.loadEpisodes(media.id, this.currentSeason);
            this.switchServer(this.currentServer);
            this.updateEpisodeBadges();
        };

        await this.loadEpisodes(media.id, this.currentSeason);
    },

    // جلب وعرض قائمة الحلقات
    async loadEpisodes(tvId, seasonNumber) {
        if (!this.episodesList) return;
        this.episodesList.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-red-500"></i>
                <p>جاري تحميل قائمة الحلقات...</p>
            </div>
        `;

        const episodes = await window.RicoAPI.getSeasonEpisodes(tvId, seasonNumber);
        this.episodesList.innerHTML = '';

        if (!episodes || episodes.length === 0) {
            this.episodesList.innerHTML = '<p class="col-span-full text-center text-gray-500 py-6">لا تتوفر حلقات لهذا الموسم.</p>';
            return;
        }

        episodes.forEach((ep) => {
            const isPlaying = ep.episodeNumber === this.currentEpisode;
            const card = document.createElement('div');
            card.className = `flex gap-3 p-2.5 rounded-xl border transition cursor-pointer group ${
                isPlaying
                    ? 'bg-red-600/10 border-red-500/60 shadow-lg shadow-red-500/10'
                    : 'bg-gray-900/60 border-gray-800 hover:border-gray-700 hover:bg-gray-800/80'
            }`;

            card.innerHTML = `
                <div class="relative w-28 h-18 sm:w-32 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                    <img src="${ep.still}" alt="${ep.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    <span class="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[10px] font-mono text-gray-300">${ep.runtime}</span>
                    <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <i class="fa-solid fa-play text-white text-base"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-center">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold ${isPlaying ? 'text-red-500' : 'text-gray-400'}">الحلقة ${ep.episodeNumber}</span>
                        <span class="text-[10px] text-yellow-500">★ ${ep.rating}</span>
                    </div>
                    <h4 class="text-sm font-semibold text-gray-100 truncate">${ep.name}</h4>
                    <p class="text-xs text-gray-400 line-clamp-1 mt-0.5">${ep.overview}</p>
                </div>
            `;

            card.addEventListener('click', () => {
                this.currentEpisode = ep.episodeNumber;
                this.updateEpisodeBadges();
                this.switchServer(this.currentServer);
                this.loadEpisodes(tvId, seasonNumber); // لإعادة تفعيل التمييز
            });

            this.episodesList.appendChild(card);
        });
    },

    // التبديل للحلقة التالية أو السابقة
    changeEpisode(direction) {
        if (!this.currentMedia || this.currentMedia.type !== 'tv') return;
        const newEp = this.currentEpisode + direction;
        if (newEp < 1) return;

        this.currentEpisode = newEp;
        this.updateEpisodeBadges();
        this.switchServer(this.currentServer);
        if (this.episodesList) {
            this.loadEpisodes(this.currentMedia.id, this.currentSeason);
        }
    },

    updateEpisodeBadges() {
        const epBadge = document.getElementById('currentPlayingEpisodeText');
        if (epBadge) {
            if (this.currentMedia?.type === 'tv') {
                epBadge.textContent = `الموسم ${this.currentSeason} - الحلقة ${this.currentEpisode}`;
                epBadge.classList.remove('hidden');
            } else {
                epBadge.classList.add('hidden');
            }
        }
    },

    // وضع السينما (تعتيم باقي الصفحة)
    toggleCinemaMode(forceState = null) {
        this.isCinemaMode = forceState !== null ? forceState : !this.isCinemaMode;
        const body = document.body;
        const playerCard = document.getElementById('playerMainCard');

        if (this.isCinemaMode) {
            body.classList.add('cinema-active');
            if (playerCard) playerCard.classList.add('cinema-highlight');
            if (this.cinemaOverlay) this.cinemaOverlay.classList.remove('hidden');
        } else {
            body.classList.remove('cinema-active');
            if (playerCard) playerCard.classList.remove('cinema-highlight');
            if (this.cinemaOverlay) this.cinemaOverlay.classList.add('hidden');
        }
    },

    // ملء الشاشة
    toggleFullscreen() {
        const elem = this.playerContainer || document.getElementById('playerMainCard');
        if (!elem) return;

        if (!document.fullscreenElement) {
            if (elem.requestFullscreen) elem.requestFullscreen();
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    },

    // حفظ في سجل المشاهدة (LocalStorage)
    saveToHistory(media, season, episode) {
        try {
            const raw = localStorage.getItem('rico_history');
            let history = raw ? JSON.parse(raw) : [];

            history = history.filter(item => item.id !== media.id);
            history.unshift({
                id: media.id,
                type: media.type,
                title: media.title,
                poster: media.poster,
                backdrop: media.backdrop,
                season,
                episode,
                timestamp: Date.now()
            });

            // الاحتفاظ بأحدث 20 عمل فقط
            if (history.length > 20) history = history.slice(0, 20);
            localStorage.setItem('rico_history', JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save watch history:', e);
        }
    }
};

window.RicoPlayer = RicoPlayer;
