// Rico Store (ريكو ستور) - Main Application Controller
const RicoApp = {
    currentLang: 'ar',
    featuredIndex: 0,
    featuredList: [],
    heroTimer: null,
    searchDebounceTimer: null,
    explorePage: 1,

    // التهيئة الشاملة للتطبيق
    async init() {
        console.log('[Rico Store] Initializing application...');

        // تهيئة المشغل
        window.RicoPlayer.init();

        // إعداد المستمعين للأحداث
        this.setupNavigation();
        this.setupSearch();
        this.setupHeroControls();
        this.setupExploreFilters();
        this.setupLanguageToggle();
        this.setupTrailerModal();
        this.updateWatchlistBadge();

        // التوجيه الأولي الفوري حسب رابط الهاش (Hash Router)
        this.handleHashChange();
        window.addEventListener('hashchange', () => this.handleHashChange());

        // تحميل بيانات الصفحة الرئيسية في الخلفية
        this.loadInitialContent();
    },

    // معالجة التنقل والصفحات (Hash-based SPA Router)
    setupNavigation() {
        // تحديث الفئات النشطة في شريط التنقل
        const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const target = link.getAttribute('data-target');
                this.setActiveNav(target);
            });
        });

        // زر العودة من شاشة المشاهدة
        const backBtn = document.getElementById('backFromWatchBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }
    },

    setActiveNav(target) {
        document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(el => {
            const matches = el.getAttribute('data-target') === target;
            if (matches) {
                el.classList.add('text-red-500');
                el.classList.remove('text-gray-300', 'text-gray-400');
            } else {
                el.classList.remove('text-red-500');
                el.classList.add('text-gray-300');
            }
        });
    },

    // معالجة تغيير الروابط
    async handleHashChange() {
        const hash = window.location.hash || '#home';
        const [route, queryString] = hash.split('?');
        const params = new URLSearchParams(queryString || '');

        // إخفاء جميع اللوحات أولاً
        document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));

        if (route === '#watch' || route.startsWith('#watch?')) {
            const type = params.get('type') || 'movie';
            const id = params.get('id');
            const season = params.get('s') || 1;
            const episode = params.get('e') || 1;

            if (id) {
                document.getElementById('watchView').classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                await this.openWatchPage(type, id, season, episode);
            } else {
                window.location.hash = '#home';
            }
        } else if (route === '#movies') {
            document.getElementById('exploreView').classList.remove('hidden');
            this.setActiveNav('movies');
            document.getElementById('filterType').value = 'movie';
            this.runExplore();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (route === '#tv') {
            document.getElementById('exploreView').classList.remove('hidden');
            this.setActiveNav('tv');
            document.getElementById('filterType').value = 'tv';
            this.runExplore();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (route === '#explore') {
            document.getElementById('exploreView').classList.remove('hidden');
            this.setActiveNav('explore');
            this.runExplore();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (route === '#watchlist') {
            document.getElementById('watchlistView').classList.remove('hidden');
            this.setActiveNav('watchlist');
            this.renderWatchlist();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // الصفحة الرئيسية الافتراضية
            document.getElementById('homeView').classList.remove('hidden');
            this.setActiveNav('home');
        }
    },

    // تحميل المحتوى الأولي للصفحة الرئيسية
    async loadInitialContent() {
        // 1. تحميل السلايدر المميز
        this.featuredList = window.RICO_MOCK_DATA.featured;
        this.renderHero(this.featuredList[0]);
        this.startHeroTimer();

        // 2. تحميل الرائج
        const trending = await window.RicoAPI.getTrending('all');
        this.renderHorizontalRow('rowTrending', trending);

        // 3. تحميل الأفلام
        const movies = await window.RicoAPI.getPopularMovies();
        this.renderHorizontalRow('rowMovies', movies);

        // 4. تحميل المسلسلات
        const tv = await window.RicoAPI.getPopularTV();
        this.renderHorizontalRow('rowTV', tv);

        // 5. تحميل الأعلى تقييماً
        const topRated = await window.RicoAPI.getTopRated('movie');
        this.renderHorizontalRow('rowTopRated', topRated);

        // 6. تحميل التصنيفات
        this.renderGenreChips();
    },

    // إعداد وتشغيل سلايدر العرض المميز (Hero Slider)
    renderHero(item) {
        if (!item) return;

        const backdrop = document.getElementById('heroBackdrop');
        const title = document.getElementById('heroTitle');
        const subTitle = document.getElementById('heroSubTitle');
        const overview = document.getElementById('heroOverview');
        const rating = document.getElementById('heroRating');
        const year = document.getElementById('heroYear');
        const duration = document.getElementById('heroDuration');
        const quality = document.getElementById('heroQuality');
        const genres = document.getElementById('heroGenres');
        const playBtn = document.getElementById('heroPlayBtn');
        const trailerBtn = document.getElementById('heroTrailerBtn');
        const bookmarkBtn = document.getElementById('heroWatchlistBtn');

        backdrop.src = item.backdrop;
        title.textContent = this.currentLang === 'ar' ? (item.title_ar || item.title) : item.title;
        subTitle.textContent = item.title_ar && item.title_ar !== item.title ? item.title : '';
        overview.textContent = this.currentLang === 'ar' ? (item.overview_ar || item.overview) : item.overview;
        rating.textContent = `★ ${item.rating}`;
        year.textContent = item.year;
        duration.textContent = item.duration;
        quality.textContent = item.quality || '4K ULTRA HD';

        // تصنيفات العمل
        genres.innerHTML = '';
        (this.currentLang === 'ar' ? item.genres : (item.genres_en || item.genres)).forEach(g => {
            const span = document.createElement('span');
            span.className = 'text-[11px] font-semibold bg-gray-900/80 border border-gray-700/80 px-2.5 py-0.5 rounded-lg text-gray-300';
            span.textContent = g;
            genres.appendChild(span);
        });

        // أحداث الأزرار
        playBtn.onclick = () => {
            window.location.hash = `#watch?type=${item.type}&id=${item.id}`;
        };

        trailerBtn.onclick = () => {
            this.openTrailer(item.trailer_key || '73_1biulkYk', item.title);
        };

        // زر المفضلة
        const isSaved = this.isInWatchlist(item.id);
        bookmarkBtn.innerHTML = `<i class="${isSaved ? 'fa-solid text-red-500' : 'fa-regular'} fa-bookmark text-base"></i>`;
        bookmarkBtn.onclick = () => {
            this.toggleWatchlist(item);
            const nowSaved = this.isInWatchlist(item.id);
            bookmarkBtn.innerHTML = `<i class="${nowSaved ? 'fa-solid text-red-500' : 'fa-regular'} fa-bookmark text-base"></i>`;
        };
    },

    setupHeroControls() {
        const nextBtn = document.getElementById('heroNextBtn');
        const prevBtn = document.getElementById('heroPrevBtn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.featuredIndex = (this.featuredIndex + 1) % this.featuredList.length;
                this.renderHero(this.featuredList[this.featuredIndex]);
                this.restartHeroTimer();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.featuredIndex = (this.featuredIndex - 1 + this.featuredList.length) % this.featuredList.length;
                this.renderHero(this.featuredList[this.featuredIndex]);
                this.restartHeroTimer();
            });
        }
    },

    startHeroTimer() {
        this.heroTimer = setInterval(() => {
            if (this.featuredList.length > 0) {
                this.featuredIndex = (this.featuredIndex + 1) % this.featuredList.length;
                this.renderHero(this.featuredList[this.featuredIndex]);
            }
        }, 7000);
    },

    restartHeroTimer() {
        if (this.heroTimer) clearInterval(this.heroTimer);
        this.startHeroTimer();
    },

    // عرض الصفوف الأفقية للبطاقات
    renderHorizontalRow(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        items.forEach(item => {
            const card = this.createMediaCard(item);
            container.appendChild(card);
        });
    },

    // إنشاء بطاقة عمل سينمائي متكاملة
    createMediaCard(item) {
        const card = document.createElement('div');
        card.className = 'media-card w-36 sm:w-44 md:w-48 cursor-pointer flex-shrink-0 group';

        const isSaved = this.isInWatchlist(item.id);

        card.innerHTML = `
            <div class="relative w-full h-56 sm:h-64 md:h-72 overflow-hidden bg-gray-900">
                <img src="${item.poster}" alt="${item.title}" loading="lazy" class="w-full h-full object-cover">
                
                <!-- شارة الجودة والنوع -->
                <div class="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    <span class="badge-quality">${item.quality || 'HD'}</span>
                    <span class="bg-red-600/90 text-[10px] font-bold text-white px-1.5 py-0.5 rounded uppercase">
                        ${item.type === 'tv' ? 'مسلسل' : 'فيلم'}
                    </span>
                </div>

                <!-- زر الحفظ في المفضلة السريع -->
                <button class="card-bookmark-btn absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition z-20">
                    <i class="${isSaved ? 'fa-solid text-red-500' : 'fa-regular'} fa-bookmark text-xs"></i>
                </button>

                <!-- تراكب عند التمرير بالماوس -->
                <div class="card-overlay">
                    <div class="flex items-center justify-center mb-6">
                        <div class="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:scale-110 transition">
                            <i class="fa-solid fa-play text-base mr-0.5"></i>
                        </div>
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="badge-rating">★ ${item.rating}</span>
                            <span class="text-[11px] text-gray-400 font-mono">${item.year}</span>
                        </div>
                        <h4 class="font-bold text-sm text-white truncate">${item.title}</h4>
                        <p class="text-[11px] text-gray-400 truncate">${(item.genres || []).join(' • ')}</p>
                    </div>
                </div>
            </div>
            <div class="p-2.5">
                <h4 class="font-bold text-xs sm:text-sm text-gray-100 truncate">${item.title}</h4>
                <div class="flex items-center justify-between mt-1 text-[11px] text-gray-400">
                    <span>${item.year}</span>
                    <span class="text-yellow-500 font-bold">★ ${item.rating}</span>
                </div>
            </div>
        `;

        // النقر على البطاقة لفتح صفحة المشاهدة
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-bookmark-btn')) return; // تجاهل نقر المفضلة
            window.location.hash = `#watch?type=${item.type}&id=${item.id}`;
        });

        // زر المفضلة في البطاقة
        const bookmarkBtn = card.querySelector('.card-bookmark-btn');
        bookmarkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleWatchlist(item);
            const savedNow = this.isInWatchlist(item.id);
            bookmarkBtn.innerHTML = `<i class="${savedNow ? 'fa-solid text-red-500' : 'fa-regular'} fa-bookmark text-xs"></i>`;
        });

        return card;
    },

    // عرض شرائح التصنيفات (Genre Chips)
    renderGenreChips() {
        const container = document.getElementById('genreChipsContainer');
        if (!container) return;
        container.innerHTML = '';

        window.RICO_MOCK_DATA.genres.forEach(g => {
            const btn = document.createElement('a');
            btn.href = `#explore?genre=${g.id}`;
            btn.className = 'flex items-center gap-2 px-4 py-2 rounded-xl bg-[#13151f] border border-gray-800 hover:border-red-500 hover:text-red-400 text-xs md:text-sm font-semibold transition text-gray-300';
            btn.innerHTML = `<i class="fa-solid ${g.icon} text-red-500"></i> <span>${g.name_ar}</span>`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.hash = '#explore';
                document.getElementById('filterGenre').value = g.id;
                this.runExplore();
            });
            container.appendChild(btn);
        });
    },

    // فتح صفحة المشاهدة التفصيلية
    async openWatchPage(type, id, season = 1, episode = 1) {
        // شاشة انتظار سريعة
        const titleEl = document.getElementById('watchTitle');
        titleEl.textContent = 'جاري تحضير المحتوى...';

        const media = await window.RicoAPI.getDetails(type, id);
        if (!media) {
            this.showToast('تعذر العثور على العمل المطلوب.');
            window.location.hash = '#home';
            return;
        }

        // تحديث معلومات الصفحة
        document.title = `${media.title} - ريكو ستور`;
        titleEl.textContent = media.title;
        document.getElementById('watchOriginalTitle').textContent = media.originalTitle;
        document.getElementById('watchOverview').textContent = media.overview;
        document.getElementById('watchPoster').src = media.poster;
        document.getElementById('watchTypeBadge').textContent = media.type === 'tv' ? 'مسلسل' : 'فيلم';
        document.getElementById('watchRatingBadge').textContent = `★ ${media.rating}`;
        document.getElementById('watchYearBadge').textContent = media.year;
        document.getElementById('watchRuntimeBadge').textContent = media.runtime;

        // التصنيفات
        const genresContainer = document.getElementById('watchGenres');
        genresContainer.innerHTML = '';
        (media.genres || []).forEach(g => {
            const span = document.createElement('span');
            span.className = 'text-xs bg-gray-800 px-2.5 py-1 rounded-lg text-gray-300 font-medium';
            span.textContent = g;
            genresContainer.appendChild(span);
        });

        // زر المفضلة
        const bookmarkBtn = document.getElementById('watchAddBookmarkBtn');
        const isSaved = this.isInWatchlist(media.id);
        bookmarkBtn.innerHTML = `<i class="${isSaved ? 'fa-solid text-red-500' : 'fa-regular'} fa-bookmark"></i> ${isSaved ? 'في مفضلاتك' : 'إضافة لمفضلاتي'}`;
        bookmarkBtn.onclick = () => {
            this.toggleWatchlist(media);
            const savedNow = this.isInWatchlist(media.id);
            bookmarkBtn.innerHTML = `<i class="${savedNow ? 'fa-solid text-red-500' : 'fa-regular'} fa-bookmark"></i> ${savedNow ? 'في مفضلاتك' : 'إضافة لمفضلاتي'}`;
        };

        // زر المشاركة
        const shareBtn = document.getElementById('watchShareBtn');
        shareBtn.onclick = () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                this.showToast('تم نسخ رابط العمل بنجاح!');
            }
        };

        // طاقم الممثلين
        const castContainer = document.getElementById('watchCastList');
        castContainer.innerHTML = '';
        (media.cast || []).forEach(c => {
            const castCard = document.createElement('div');
            castCard.className = 'w-20 flex-shrink-0 text-center';
            castCard.innerHTML = `
                <div class="w-16 h-16 mx-auto rounded-full overflow-hidden border border-gray-700 mb-1.5 bg-gray-900">
                    <img src="${c.profile}" alt="${c.name}" class="w-full h-full object-cover">
                </div>
                <h5 class="text-[11px] font-bold text-white truncate">${c.name}</h5>
                <p class="text-[9px] text-gray-400 truncate">${c.character || ''}</p>
            `;
            castContainer.appendChild(castCard);
        });

        // أعمال مشابهة
        const similarContainer = document.getElementById('watchSimilarList');
        similarContainer.innerHTML = '';
        (media.similar || []).slice(0, 5).forEach(sim => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800/60 cursor-pointer transition';
            row.innerHTML = `
                <img src="${sim.poster}" class="w-12 h-16 rounded-lg object-cover" alt="${sim.title}">
                <div class="flex-1 min-w-0">
                    <h5 class="text-xs font-bold text-white truncate">${sim.title}</h5>
                    <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span class="text-yellow-500">★ ${sim.rating}</span>
                        <span>${sim.year}</span>
                    </div>
                </div>
            `;
            row.onclick = () => {
                window.location.hash = `#watch?type=${sim.type}&id=${sim.id}`;
            };
            similarContainer.appendChild(row);
        });

        // تحميل الفيديو وخوادم البث
        await window.RicoPlayer.loadMedia(media, season, episode);
    },

    // إعداد البحث الفوري
    setupSearch() {
        const input = document.getElementById('quickSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        const dropdown = document.getElementById('searchDropdown');

        input.addEventListener('input', () => {
            const query = input.value.trim();
            if (query.length > 0) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
                dropdown.classList.add('hidden');
                return;
            }

            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = setTimeout(async () => {
                const results = await window.RicoAPI.search(query);
                this.renderSearchResults(results);
            }, 300);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.classList.add('hidden');
            dropdown.classList.add('hidden');
        });

        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#quickSearchInput') && !e.target.closest('#searchDropdown')) {
                dropdown.classList.add('hidden');
            }
        });
    },

    // عرض نتائج البحث في القائمة المنبثقة
    renderSearchResults(results) {
        const dropdown = document.getElementById('searchDropdown');
        dropdown.innerHTML = '';

        if (!results || results.length === 0) {
            dropdown.innerHTML = '<div class="p-4 text-center text-xs text-gray-400">لا توجد نتائج تطابق بحثك.</div>';
            dropdown.classList.remove('hidden');
            return;
        }

        results.slice(0, 8).forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex items-center gap-3 p-3 hover:bg-gray-800/80 cursor-pointer border-b border-gray-800/40 last:border-0 transition';
            itemEl.innerHTML = `
                <img src="${item.poster}" class="w-11 h-15 rounded-lg object-cover bg-gray-900" alt="${item.title}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="text-[10px] bg-red-600/30 text-red-400 px-1.5 py-0.2 rounded font-bold uppercase">${item.type === 'tv' ? 'مسلسل' : 'فيلم'}</span>
                        <span class="text-xs text-yellow-500 font-bold">★ ${item.rating}</span>
                        <span class="text-[11px] text-gray-400">${item.year}</span>
                    </div>
                    <h5 class="text-sm font-bold text-white truncate">${item.title}</h5>
                    <p class="text-[11px] text-gray-400 truncate">${(item.genres || []).join(', ')}</p>
                </div>
            `;

            itemEl.onclick = () => {
                dropdown.classList.add('hidden');
                document.getElementById('quickSearchInput').value = '';
                document.getElementById('clearSearchBtn').classList.add('hidden');
                window.location.hash = `#watch?type=${item.type}&id=${item.id}`;
            };

            dropdown.appendChild(itemEl);
        });

        dropdown.classList.remove('hidden');
    },

    // إعداد وتشغيل نافذة إعلان اليوتيوب
    setupTrailerModal() {
        const modal = document.getElementById('trailerModal');
        const closeBtn = document.getElementById('closeTrailerBtn');
        const iframe = document.getElementById('trailerIframe');

        const closeModal = () => {
            iframe.src = '';
            modal.classList.add('hidden');
        };

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.add) closeModal();
        });
    },

    openTrailer(youtubeKey, title) {
        const modal = document.getElementById('trailerModal');
        const iframe = document.getElementById('trailerIframe');
        const titleEl = document.getElementById('trailerModalTitle');

        titleEl.innerHTML = `<i class="fa-brands fa-youtube text-red-600 text-xl"></i> الإعلان الرسمي: ${title}`;
        iframe.src = `https://www.youtube.com/embed/${youtubeKey}?autoplay=1`;
        modal.classList.remove('hidden');
    },

    // إعداد محرك الاستكشاف والفلترة (Explore & Filters)
    setupExploreFilters() {
        const filterType = document.getElementById('filterType');
        const filterGenre = document.getElementById('filterGenre');
        const filterYear = document.getElementById('filterYear');
        const filterSort = document.getElementById('filterSort');
        const loadMoreBtn = document.getElementById('exploreLoadMoreBtn');

        const trigger = () => {
            this.explorePage = 1;
            this.runExplore(false);
        };

        filterType.onchange = trigger;
        filterGenre.onchange = trigger;
        filterYear.onchange = trigger;
        filterSort.onchange = trigger;

        loadMoreBtn.onclick = () => {
            this.explorePage++;
            this.runExplore(true);
        };
    },

    async runExplore(append = false) {
        const container = document.getElementById('exploreResultsGrid');
        const type = document.getElementById('filterType').value;
        const genre = document.getElementById('filterGenre').value;
        const year = document.getElementById('filterYear').value;
        const sortBy = document.getElementById('filterSort').value;

        if (!append) {
            container.innerHTML = `
                <div class="col-span-full py-16 text-center text-gray-400">
                    <i class="fa-solid fa-spinner fa-spin text-3xl mb-3 text-red-500"></i>
                    <p>جاري استخراج الأعمال الفنية المحددة...</p>
                </div>
            `;
        }

        const data = await window.RicoAPI.discover({
            type,
            genre,
            year,
            sortBy,
            page: this.explorePage
        });

        if (!append) container.innerHTML = '';

        if (!data.results || data.results.length === 0) {
            if (!append) {
                container.innerHTML = '<div class="col-span-full py-16 text-center text-gray-500">لا توجد أعمال تطابق الفلاتر المختارة.</div>';
            }
            return;
        }

        data.results.forEach(item => {
            const card = this.createMediaCard(item);
            container.appendChild(card);
        });
    },

    // إدارة قائمة المفضلة (Watchlist)
    getWatchlist() {
        try {
            const raw = localStorage.getItem('rico_watchlist');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },

    isInWatchlist(id) {
        const list = this.getWatchlist();
        return list.some(item => item.id == id);
    },

    toggleWatchlist(item) {
        let list = this.getWatchlist();
        const exists = list.some(i => i.id == item.id);

        if (exists) {
            list = list.filter(i => i.id != item.id);
            this.showToast(`تمت إزالة "${item.title}" من المفضلات.`);
        } else {
            list.unshift({
                id: item.id,
                type: item.type,
                title: item.title,
                poster: item.poster,
                backdrop: item.backdrop,
                rating: item.rating,
                year: item.year,
                quality: item.quality || 'HD',
                genres: item.genres || []
            });
            this.showToast(`تمت إضافة "${item.title}" إلى المفضلات.`);
        }

        localStorage.setItem('rico_watchlist', JSON.stringify(list));
        this.updateWatchlistBadge();

        // تحديث شبكة المفضلة إذا كانت معروضة
        if (!document.getElementById('watchlistView').classList.contains('hidden')) {
            this.renderWatchlist();
        }
    },

    updateWatchlistBadge() {
        const badge = document.getElementById('watchlistCountBadge');
        const list = this.getWatchlist();
        if (list.length > 0) {
            badge.textContent = list.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    renderWatchlist() {
        const container = document.getElementById('watchlistGrid');
        const emptyState = document.getElementById('watchlistEmptyState');
        const clearBtn = document.getElementById('clearWatchlistBtn');
        const list = this.getWatchlist();

        container.innerHTML = '';

        if (list.length === 0) {
            emptyState.classList.remove('hidden');
            clearBtn.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        clearBtn.classList.remove('hidden');

        list.forEach(item => {
            const card = this.createMediaCard(item);
            container.appendChild(card);
        });

        clearBtn.onclick = () => {
            if (confirm('هل أنت متأكد من مسح جميع عناصر المفضلة؟')) {
                localStorage.removeItem('rico_watchlist');
                this.updateWatchlistBadge();
                this.renderWatchlist();
                this.showToast('تم إفراغ قائمة المفضلات.');
            }
        };
    },

    // إشعار رقيق (Toast Notification)
    showToast(message) {
        const toast = document.getElementById('toastNotification');
        const text = document.getElementById('toastMessage');
        text.textContent = message;
        toast.classList.add('show');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // تبديل اللغة (العربية / الإنجليزية)
    setupLanguageToggle() {
        const btn = document.getElementById('langToggleBtn');
        const label = document.getElementById('langLabel');

        btn.onclick = () => {
            this.currentLang = this.currentLang === 'ar' ? 'en' : 'ar';
            document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = this.currentLang;
            label.textContent = this.currentLang === 'ar' ? 'English' : 'العربية';

            // إعادة رسم السلايدر
            if (this.featuredList.length > 0) {
                this.renderHero(this.featuredList[this.featuredIndex]);
            }
            this.showToast(this.currentLang === 'ar' ? 'تم تحويل الواجهة للعربية' : 'Switched to English');
        };
    }
};

window.RicoApp = RicoApp;

// بدء تشغيل الموقع فور اكتمال تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
    window.RicoApp.init();
});
