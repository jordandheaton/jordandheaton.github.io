/* ballroom.js — motion engine for The Art of Ballroom */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasGsap = typeof gsap !== 'undefined';
    var hasST = typeof ScrollTrigger !== 'undefined';
    var hasLenis = typeof Lenis !== 'undefined';

    if (hasGsap && hasST) gsap.registerPlugin(ScrollTrigger);

    /* ---------- Smooth scroll ---------- */
    var lenis = null;
    if (hasLenis && !reduceMotion) {
        lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
        window.__lenis = lenis;
        if (hasGsap) {
            lenis.on('scroll', function () { if (hasST) ScrollTrigger.update(); });
            gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
            gsap.ticker.lagSmoothing(0);
        } else {
            (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);
        }
    }

    /* ---------- Anchor nav (works with Lenis) ---------- */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var target = document.querySelector(a.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            if (lenis) lenis.scrollTo(target, { offset: 0 });
            else target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    /* ---------- Video fallback wiring ---------- */
    function wireVideo(container, video) {
        if (!video) { container.classList.add('no-video'); return; }
        var sources = video.querySelectorAll('source');
        var markBroken = function () { container.classList.add('no-video'); };
        video.addEventListener('error', markBroken);
        sources.forEach(function (s) { s.addEventListener('error', markBroken); });
        // Kick playback once decodable — the observer can fire before the video is ready
        video.addEventListener('canplay', function () {
            var rect = container.getBoundingClientRect();
            var visible = rect.bottom > 0 && rect.top < window.innerHeight;
            if (visible && video.paused && !container.classList.contains('no-video')) {
                video.play().catch(function () {});
            }
        });
        // Play/pause based on visibility to save battery
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (container.classList.contains('no-video')) return;
                    if (entry.isIntersecting) { video.play().catch(function () {}); }
                    else { video.pause(); }
                });
            }, { threshold: 0.2 }).observe(container);
        }
    }
    var heroBg = document.getElementById('heroBg');
    wireVideo(heroBg, document.getElementById('heroVideo'));
    document.querySelectorAll('.dance-media').forEach(function (m) {
        var v = m.querySelector('.panel-video');
        if (v) wireVideo(m, v);
    });

    /* ---------- Placeholder accent tinting ---------- */
    document.querySelectorAll('.panel.dance').forEach(function (p) {
        var accent = p.getAttribute('data-accent');
        if (accent) p.style.setProperty('--accent', accent);
    });

    /* ---------- Gold dust canvas (pseudo-3D particle waltz) ---------- */
    var canvas = document.getElementById('dust');
    if (canvas && !reduceMotion) {
        var ctx = canvas.getContext('2d');
        var W, H, CX, CY;
        var FOV = 420;
        var particles = [];
        var COUNT = Math.min(160, Math.floor(window.innerWidth / 9));
        var scrollDrift = 0;

        function resize() {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
            CX = W / 2; CY = H / 2;
        }
        resize();
        window.addEventListener('resize', resize);

        for (var i = 0; i < COUNT; i++) {
            particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: 80 + Math.random() * Math.max(W, H) * 0.55,
                z: Math.random() * 700 - 350,
                speed: 0.0006 + Math.random() * 0.0018,
                size: 0.6 + Math.random() * 1.7,
                flicker: Math.random() * Math.PI * 2
            });
        }

        window.addEventListener('scroll', function () {
            scrollDrift = window.scrollY * 0.0002;
        }, { passive: true });

        var last = 0;
        function tick(now) {
            var dt = Math.min(now - last, 50) || 16;
            last = now;
            ctx.clearRect(0, 0, W, H);
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.angle += p.speed * dt * (0.38 + scrollDrift * 6);
                p.flicker += 0.002 * dt;
                var scale = FOV / (FOV + p.z);
                var x = CX + Math.cos(p.angle) * p.radius * scale;
                var y = CY + Math.sin(p.angle) * p.radius * 0.42 * scale + Math.sin(p.flicker) * 6;
                var alpha = Math.max(0, 0.08 + 0.3 * scale * (0.6 + 0.4 * Math.sin(p.flicker)));
                ctx.beginPath();
                ctx.arc(x, y, p.size * scale, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(212, 175, 55, ' + alpha.toFixed(3) + ')';
                ctx.fill();
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /* ---------- Preloader ---------- */
    var preloader = document.getElementById('preloader');
    var countEl = document.getElementById('preloaderCount');
    function finishLoad() {
        document.body.classList.remove('is-loading');
        if (hasGsap) {
            gsap.to(preloader, { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' });
            introReveal();
        } else {
            preloader.style.display = 'none';
            document.querySelectorAll('.reveal-line').forEach(function (el) {
                el.style.opacity = 1; el.style.transform = 'none';
            });
        }
    }
    if (preloader && countEl && hasGsap && !reduceMotion) {
        var counter = { v: 0 };
        gsap.to(counter, {
            v: 100,
            duration: 1.1,
            ease: 'power2.inOut',
            onUpdate: function () {
                countEl.textContent = String(Math.round(counter.v)).padStart(2, '0');
            },
            onComplete: finishLoad
        });
    } else {
        finishLoad();
    }

    /* ---------- Hero intro ---------- */
    function introReveal() {
        if (!hasGsap) return;
        var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.hero-title .word', { yPercent: 120, duration: 1.0, stagger: 0.08 }, 0.1)
          .from('.hero-title em', { yPercent: 120, duration: 1.1 }, 0.25)
          .to('.hero-kicker', { opacity: 1, y: 0, duration: 0.8 }, 0.5)
          .to('.hero-sub', { opacity: 1, y: 0, duration: 0.8 }, 0.65)
          .from('.hero-bg', { opacity: 0, duration: 1.6, ease: 'power2.inOut' }, 0)
          .from('.hero-scroll-cue', { opacity: 0, duration: 0.8 }, 1.1);
    }

    /* ---------- Hero background: mouse drift + scroll depth ---------- */
    if (heroBg && hasGsap && !reduceMotion) {
        var heroVid = heroBg.querySelector('.hero-video');
        if (heroVid) {
            gsap.set(heroVid, { scale: 1.06 }); // headroom so drift never reveals edges
            var driftX = gsap.quickTo(heroVid, 'x', { duration: 1.2, ease: 'power2.out' });
            var driftY = gsap.quickTo(heroVid, 'y', { duration: 1.2, ease: 'power2.out' });
            window.addEventListener('mousemove', function (e) {
                var nx = (e.clientX / window.innerWidth) - 0.5;
                var ny = (e.clientY / window.innerHeight) - 0.5;
                driftX(nx * -18);
                driftY(ny * -10);
            });
            if (hasST) {
                gsap.to(heroVid, {
                    scale: 1.14,
                    yPercent: 6,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '#hero',
                        start: 'top top',
                        end: 'bottom top',
                        scrub: 0.6
                    }
                });
            }
        }
    }

    /* ---------- Scroll-driven sections ---------- */
    if (hasGsap && hasST && !reduceMotion) {

        // Ghost words drift
        document.querySelectorAll('.ghost-word').forEach(function (w) {
            gsap.to(w, {
                yPercent: 40,
                scrollTrigger: { trigger: w.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 }
            });
        });

        // Story photo parallax + text reveal
        gsap.fromTo('.photo-mask img', { yPercent: -3 }, {
            yPercent: 3, scale: 1.08,
            scrollTrigger: { trigger: '.story-photo', start: 'top bottom', end: 'bottom top', scrub: 1 }
        });
        gsap.from('.story-text > *', {
            opacity: 0, y: 40, stagger: 0.12, duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: '#story', start: 'top 65%' }
        });

        // Section titles generally
        gsap.utils.toArray('.dances-heading, .formation-inner').forEach(function (el) {
            gsap.from(el.children, {
                opacity: 0, y: 40, stagger: 0.1, duration: 0.9, ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 70%' }
            });
        });

        // The Ten: horizontal pinned journey on desktop
        var mm = gsap.matchMedia();
        mm.add('(min-width: 900px)', function () {
            var track = document.getElementById('track');
            var wrap = document.getElementById('trackWrap');
            var getDistance = function () { return track.scrollWidth - window.innerWidth; };

            var tween = gsap.to(track, {
                x: function () { return -getDistance(); },
                ease: 'none',
                scrollTrigger: {
                    trigger: wrap,
                    start: 'top top',
                    end: function () { return '+=' + getDistance(); },
                    pin: true,
                    scrub: 0.8,
                    invalidateOnRefresh: true,
                    anticipatePin: 1
                }
            });

            // Per-panel media zoom as it passes center
            gsap.utils.toArray('.panel.dance .dance-media').forEach(function (media) {
                gsap.fromTo(media, { scale: 0.92 }, {
                    scale: 1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: media,
                        containerAnimation: tween,
                        start: 'left 85%',
                        end: 'left 40%',
                        scrub: true
                    }
                });
            });

            return function () {}; // cleanup handled by matchMedia
        });

        // Mobile: simple staggered reveals for panels
        mm.add('(max-width: 899px)', function () {
            gsap.utils.toArray('.panel').forEach(function (panel) {
                gsap.from(panel.children, {
                    opacity: 0, y: 36, stagger: 0.08, duration: 0.8, ease: 'power3.out',
                    scrollTrigger: { trigger: panel, start: 'top 78%' }
                });
            });
        });

        // Footer flourish
        gsap.from('.footer-big', {
            opacity: 0, y: 30, duration: 1, ease: 'power3.out',
            scrollTrigger: { trigger: '.page-footer', start: 'top 85%' }
        });
    }
})();
