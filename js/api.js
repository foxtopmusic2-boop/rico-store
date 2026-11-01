// Rico Store (ريكو ستور) - TMDB & Content API Engine
const RicoAPI = {
    apiKey: '4e44d9029b1270a757cddc766a1bcb63',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBase: 'https://image.tmdb.org/t/p',

    // مساعد لتنسيق روابط الصور
    getImageUrl(path, size = 'w500') {
        if (!path) return 'https://via.placeholder.com/500x750/161922/ffffff?text=Rico+Store';
        if (path.startsWith('http')) return path;
        return `${this.imageBase}/${size}${path}`;
    },

    // طلب موحد للـ API مع معالجة الأخطاء والتخزين المؤقت
    async request(endpoint, params = {}) {
        const queryParams = new URLSearchParams({
            api_key: this.apiKey,
            language: 'ar-SA', // العربية افتراضياً
            ...params
        });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(`${this.baseUrl}${endpoint}?${queryParams.toString()}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            return await res.json();
        } catch (err) {
            console.warn(`[Rico Store API] Error fetching ${endpoint}:`, err.message);
            return null;
        }
    },

    // طلب باللغة الإنجليزية كبديل إذا لم تتوفر الترجمة
    async requestEn(endpoint, params = {}) {
        return this.request(endpoint, { ...params, language: 'en-US' });
    },

    // الأعمال الرائجة اليوم
    async getTrending(type = 'all', time = 'day') {
        const data = await this.request(`/trending/${type}/${time}`);
        if (data && data.results && data.results.length > 0) {
            return this.formatList(data.results);
        }
        return type === 'tv' ? window.RICO_MOCK_DATA.trendingTV : window.RICO_MOCK_DATA.trendingMovies;
    },

    // الأفلام الأكثر شعبية
    async getPopularMovies(page = 1) {
        const data = await this.request('/movie/popular', { page });
        if (data && data.results && data.results.length > 0) {
            return this.formatList(data.results, 'movie');
        }
        return window.RICO_MOCK_DATA.trendingMovies;
    },

    // المسلسلات الأكثر شعبية
    async getPopularTV(page = 1) {
        const data = await this.request('/tv/popular', { page });
        if (data && data.results && data.results.length > 0) {
            return this.formatList(data.results, 'tv');
        }
        return window.RICO_MOCK_DATA.trendingTV;
    },

    // الأعمال الأعلى تقييماً
    async getTopRated(type = 'movie', page = 1) {
        const data = await this.request(`/${type}/top_rated`, { page });
        if (data && data.results && data.results.length > 0) {
            return this.formatList(data.results, type);
        }
        return window.RICO_MOCK_DATA.topRated;
    },

    // البحث المباشر السريع مع دعم البحث الاحتياطي المحلي
    async search(query, page = 1) {
        if (!query || query.trim() === '') return [];
        const q = query.trim().toLowerCase();

        try {
            const data = await this.request('/search/multi', {
                query: query.trim(),
                page,
                include_adult: false
            });

            if (data && data.results && data.results.length > 0) {
                const valid = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
                if (valid.length > 0) {
                    return this.formatList(valid);
                }
            }
        } catch (e) {
            console.warn('[Rico Search] API search fallback triggered:', e);
        }

        // بحث احتياطي فوري وسريع في قاعدة البيانات المدمجة
        const allItems = [
            ...window.RICO_MOCK_DATA.featured,
            ...window.RICO_MOCK_DATA.trendingMovies,
            ...window.RICO_MOCK_DATA.trendingTV,
            ...window.RICO_MOCK_DATA.topRated
        ];

        const matched = allItems.filter(item => {
            const titleEn = (item.title || '').toLowerCase();
            const titleAr = (item.title_ar || '').toLowerCase();
            const originalTitle = (item.originalTitle || '').toLowerCase();
            return titleEn.includes(q) || titleAr.includes(q) || originalTitle.includes(q);
        });

        // إزالة التكرارات
        const unique = [];
        const seen = new Set();
        for (const item of matched) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                unique.push(item);
            }
        }
        return unique;
    },

    // تصفية واستكشاف المحتوى (Explore & Filters)
    async discover({ type = 'movie', genre = '', year = '', sortBy = 'popularity.desc', page = 1 }) {
        const params = {
            page,
            sort_by: sortBy,
            include_adult: false
        };
        if (genre) params.with_genres = genre;
        if (year) {
            if (type === 'movie') params.primary_release_year = year;
            else params.first_air_date_year = year;
        }

        try {
            const data = await this.request(`/discover/${type}`, params);
            if (data && data.results && data.results.length > 0) {
                return {
                    results: this.formatList(data.results, type),
                    totalPages: data.total_pages || 1,
                    page: data.page || 1
                };
            }
        } catch (e) {
            console.warn('[Rico Discover] API fallback triggered:', e);
        }

        // بديل محلي عند انقطاع الاتصال
        const pool = type === 'tv'
            ? [...window.RICO_MOCK_DATA.trendingTV]
            : [...window.RICO_MOCK_DATA.trendingMovies, ...window.RICO_MOCK_DATA.topRated];

        return {
            results: pool,
            totalPages: 1,
            page: 1
        };
    },

    // تفاصيل العمل الكاملة (فيديو، طاقم، توصيات)
    async getDetails(type, id) {
        // جلب باللغتين العربية والإنجليزية لضمان أفضل تغطية للملخص والعنوان
        const [arData, enData] = await Promise.all([
            this.request(`/${type}/${id}`, { append_to_response: 'videos,credits,similar,recommendations' }),
            this.requestEn(`/${type}/${id}`, { append_to_response: 'videos,credits' })
        ]);

        const raw = arData || enData;
        if (!raw) {
            // البحث في البيانات المدمجة
            const allMock = [
                ...window.RICO_MOCK_DATA.featured,
                ...window.RICO_MOCK_DATA.trendingMovies,
                ...window.RICO_MOCK_DATA.trendingTV,
                ...window.RICO_MOCK_DATA.topRated
            ];
            const found = allMock.find(item => item.id == id);
            return found || null;
        }

        const trailer = (raw.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
            || (enData?.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
            || (raw.videos?.results || [])[0];

        const title = raw.title || raw.name || enData?.title || enData?.name || 'بدون عنوان';
        const originalTitle = raw.original_title || raw.original_name || title;
        const overview = (raw.overview && raw.overview.length > 15) ? raw.overview : (enData?.overview || 'لا يتوفر ملخص لهذا العمل حالياً.');

        return {
            id: raw.id,
            type,
            title,
            originalTitle,
            overview,
            poster: this.getImageUrl(raw.poster_path, 'w500'),
            backdrop: this.getImageUrl(raw.backdrop_path, 'original'),
            rating: raw.vote_average ? Number(raw.vote_average.toFixed(1)) : 7.5,
            voteCount: raw.vote_count || 120,
            year: (raw.release_date || raw.first_air_date || '2024').substring(0, 4),
            runtime: raw.runtime ? `${raw.runtime} دقيقة` : (raw.number_of_seasons ? `${raw.number_of_seasons} مواسم` : 'غير محدد'),
            quality: '4K ULTRA HD',
            ageRating: raw.adult ? '18+' : '13+',
            genres: (raw.genres || []).map(g => g.name),
            status: raw.status || 'تم العرض',
            trailerKey: trailer ? trailer.key : null,
            cast: (raw.credits?.cast || []).slice(0, 10).map(c => ({
                id: c.id,
                name: c.name,
                character: c.character,
                profile: this.getImageUrl(c.profile_path, 'w185')
            })),
            seasons: raw.seasons || [],
            numberOfSeasons: raw.number_of_seasons || (raw.seasons ? raw.seasons.length : 1),
            numberOfEpisodes: raw.number_of_episodes || 10,
            similar: this.formatList(raw.similar?.results || raw.recommendations?.results || [], type)
        };
    },

    // جلب حلقات موسم محدد لمسلسل
    async getSeasonEpisodes(tvId, seasonNumber = 1) {
        const [arSeason, enSeason] = await Promise.all([
            this.request(`/tv/${tvId}/season/${seasonNumber}`),
            this.requestEn(`/tv/${tvId}/season/${seasonNumber}`)
        ]);

        const raw = arSeason || enSeason;
        if (raw && raw.episodes) {
            return raw.episodes.map(ep => {
                const enEp = (enSeason?.episodes || []).find(e => e.episode_number === ep.episode_number);
                return {
                    episodeNumber: ep.episode_number,
                    seasonNumber: ep.season_number,
                    name: ep.name || enEp?.name || `الحلقة ${ep.episode_number}`,
                    overview: ep.overview || enEp?.overview || 'شاهد الحلقة كاملة بجودة عالية على ريكو ستور.',
                    still: this.getImageUrl(ep.still_path, 'w300'),
                    rating: ep.vote_average ? ep.vote_average.toFixed(1) : '8.0',
                    runtime: ep.runtime ? `${ep.runtime} د` : '45 د',
                    airDate: ep.air_date || ''
                };
            });
        }

        // حلقات تجريبية واقعية كبديل
        return Array.from({ length: 10 }, (_, i) => ({
            episodeNumber: i + 1,
            seasonNumber,
            name: `الحلقة ${i + 1}`,
            overview: `أحداث مشوقة ومثيرة في الحلقة ${i + 1} من الموسم ${seasonNumber} حصرياً على ريكو ستور.`,
            still: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=400&q=80',
            rating: '8.4',
            runtime: '50 د',
            airDate: '2024'
        }));
    },

    // تنسيق قائمة العناصر المستلمة
    formatList(list, forceType = null) {
        return list
            .filter(item => item.poster_path || item.backdrop_path)
            .map(item => {
                const type = forceType || item.media_type || (item.title ? 'movie' : 'tv');
                return {
                    id: item.id,
                    type,
                    title: item.title || item.name || 'عمل سينمائي',
                    originalTitle: item.original_title || item.original_name || '',
                    poster: this.getImageUrl(item.poster_path, 'w500'),
                    backdrop: this.getImageUrl(item.backdrop_path, 'original'),
                    rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : 7.8,
                    year: (item.release_date || item.first_air_date || '2024').substring(0, 4),
                    quality: item.vote_average > 7.5 ? '4K' : 'HD',
                    genres: this.mapGenreIds(item.genre_ids || [])
                };
            });
    },

    // تحويل معرفات التصنيفات لأسماء عربية
    mapGenreIds(ids) {
        const map = {
            28: 'أكشن', 12: 'مغامرة', 16: 'أنمي', 35: 'كوميديا', 80: 'جريمة',
            99: 'وثائقي', 18: 'دراما', 10751: 'عائلي', 14: 'فانتازيا', 36: 'تاريخ',
            27: 'رعب', 10402: 'موسيقى', 9648: 'غموض', 10749: 'رومانسي', 878: 'خيال علمي',
            10770: 'تلفزيوني', 53: 'إثارة', 10752: 'حرب', 37: 'غرب أمريكي'
        };
        return ids.slice(0, 2).map(id => map[id] || 'منوع');
    }
};

window.RicoAPI = RicoAPI;
