/* ============================================
   SCRIPT.JS — 3D Scene + Smooth Scroll + Effects
   ============================================ */

(() => {
    'use strict';

    // ---- THREE.JS 3D PARTICLE SCENE ----

    const canvas = document.getElementById('bg-canvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);

    camera.position.z = 30;

    // --- Particle System ---
    const PARTICLE_COUNT = 2000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    const palette = [
        { r: 1, g: 1, b: 1 },        // pure white
        { r: 0.85, g: 0.85, b: 0.85 }, // light grey
        { r: 0.7, g: 0.7, b: 0.7 },   // medium grey
        { r: 0.95, g: 0.95, b: 0.95 }, // near white
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 100;
        positions[i3 + 1] = (Math.random() - 0.5) * 100;
        positions[i3 + 2] = (Math.random() - 0.5) * 80;

        const color = palette[Math.floor(Math.random() * palette.length)];
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;

        sizes[i] = Math.random() * 2 + 0.5;

        velocities[i3] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for particles
    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uScrollProgress: { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) },
        },
        vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uScrollProgress;

      void main() {
        vColor = color;
        vec3 pos = position;
        pos.x += sin(uTime * 0.3 + position.y * 0.1) * 0.5;
        pos.y += cos(uTime * 0.2 + position.x * 0.1) * 0.5;
        pos.z += sin(uTime * 0.15 + position.z * 0.05) * 1.0;

        // Slight rotation based on scroll
        float angle = uScrollProgress * 3.14159 * 0.5;
        float cosA = cos(angle);
        float sinA = sin(angle);
        float newX = pos.x * cosA - pos.z * sinA;
        float newZ = pos.x * sinA + pos.z * cosA;
        pos.x = newX;
        pos.z = newZ;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;

        float dist = length(mvPosition.xyz);
        vAlpha = smoothstep(80.0, 10.0, dist) * 0.8;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        glow = pow(glow, 1.5);
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // --- Grid plane ---
    const gridGeometry = new THREE.PlaneGeometry(200, 200, 60, 60);
    const gridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uScrollProgress: { value: 0 },
        },
        vertexShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uScrollProgress;

      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 0.1 + uTime * 0.5) * 1.5;
        pos.z += cos(pos.y * 0.1 + uTime * 0.3) * 1.5;
        vPos = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
        fragmentShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      uniform float uTime;

      void main() {
        vec2 grid = abs(fract(vUv * 30.0 - 0.5) - 0.5) / fwidth(vUv * 30.0);
        float line = min(grid.x, grid.y);
        float gridAlpha = 1.0 - min(line, 1.0);

        float dist = length(vUv - 0.5);
        float fade = smoothstep(0.5, 0.15, dist);

        vec3 color = mix(vec3(0.3, 0.3, 0.3), vec3(1.0, 1.0, 1.0), fade * 0.5);

        gl_FragColor = vec4(color, gridAlpha * fade * 0.12);
      }
    `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    grid.rotation.x = -Math.PI * 0.5;
    grid.position.y = -20;
    scene.add(grid);

    // --- Floating code lines (3D text-like geometry) ---
    const lineGroup = new THREE.Group();
    const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.06,
    });

    for (let i = 0; i < 20; i++) {
        const width = Math.random() * 8 + 2;
        const lineGeo = new THREE.BoxGeometry(width, 0.08, 0.08);
        const line = new THREE.Mesh(lineGeo, lineMaterial.clone());
        line.position.set(
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 30 - 10
        );
        line.material.opacity = Math.random() * 0.08 + 0.02;
        line.userData = {
            speed: Math.random() * 0.005 + 0.002,
            amplitude: Math.random() * 2 + 1,
            offset: Math.random() * Math.PI * 2,
        };
        lineGroup.add(line);
    }
    scene.add(lineGroup);

    // --- Mouse tracking ---
    let mouseX = 0, mouseY = 0;
    let targetMouseX = 0, targetMouseY = 0;

    document.addEventListener('mousemove', (e) => {
        targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // --- Scroll tracking ---
    let scrollProgress = 0;
    let targetScrollProgress = 0;

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        targetScrollProgress = docHeight > 0 ? scrollTop / docHeight : 0;

        // Update scroll progress bar
        const progressBar = document.getElementById('scroll-progress');
        if (progressBar) {
            progressBar.style.width = (targetScrollProgress * 100) + '%';
        }
    });

    // --- Resize handler ---
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // --- Animation loop ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Smooth mouse interpolation
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;

        // Smooth scroll interpolation
        scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;

        // Update uniforms
        particleMaterial.uniforms.uTime.value = elapsedTime;
        particleMaterial.uniforms.uScrollProgress.value = scrollProgress;
        particleMaterial.uniforms.uMouse.value.set(mouseX, mouseY);

        gridMaterial.uniforms.uTime.value = elapsedTime;
        gridMaterial.uniforms.uScrollProgress.value = scrollProgress;

        // Camera follows mouse
        camera.position.x += (mouseX * 3 - camera.position.x) * 0.02;
        camera.position.y += (mouseY * 2 + 2 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, 0);

        // Animate floating code lines
        lineGroup.children.forEach((line) => {
            const { speed, amplitude, offset } = line.userData;
            line.position.y += Math.sin(elapsedTime * speed * 10 + offset) * 0.01;
            line.position.x += speed * 0.3;
            if (line.position.x > 35) line.position.x = -35;
        });

        // Slight particle rotation
        particles.rotation.y = elapsedTime * 0.02;

        // Grid undulation based on scroll
        grid.position.y = -20 + scrollProgress * 10;
        grid.rotation.z = scrollProgress * 0.2;

        renderer.render(scene, camera);
    }

    animate();


    // ---- SMOOTH SCROLL SECTION TRANSITIONS ----

    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-link');

    // IntersectionObserver for section reveal
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const inner = entry.target.querySelector('.section-inner');
                if (!inner) return;

                if (entry.isIntersecting) {
                    inner.classList.add('visible');

                    // Update active nav link
                    const sectionId = entry.target.id;
                    navLinks.forEach((link) => {
                        link.classList.toggle('active', link.dataset.section === sectionId);
                    });
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '-50px',
        }
    );

    sections.forEach((section) => revealObserver.observe(section));

    // Staggered reveal for child elements
    const staggerObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const children = entry.target.querySelectorAll(
                        '.about-card, .skill-category, .project-card, .exp-card, .achievement-card, .form-group, .social-link'
                    );
                    children.forEach((child, index) => {
                        child.style.opacity = '0';
                        child.style.transform = 'translateY(30px)';
                        child.style.transition = `opacity 0.6s ${index * 0.12}s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.6s ${index * 0.12}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
                        setTimeout(() => {
                            child.style.opacity = '1';
                            child.style.transform = 'translateY(0)';
                        }, 50);
                    });
                    staggerObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );

    sections.forEach((section) => staggerObserver.observe(section));


    // ---- EXPERIENCE BAR ANIMATION ----

    const expBarObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const bars = entry.target.querySelectorAll('.exp-bar-fill');
                    bars.forEach((bar, index) => {
                        const percent = bar.dataset.percent;
                        bar.style.setProperty('--bar-width', percent + '%');
                        setTimeout(() => {
                            bar.classList.add('animated');
                        }, index * 200 + 300);
                    });
                    expBarObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.2 }
    );

    const expSection = document.getElementById('experience');
    if (expSection) expBarObserver.observe(expSection);


    // ---- ACHIEVEMENT PROGRESS BAR ANIMATION ----

    const achievementBarObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const bars = entry.target.querySelectorAll('.achievement-progress-fill');
                    bars.forEach((bar, index) => {
                        const progress = bar.dataset.progress;
                        bar.style.setProperty('--progress-width', progress + '%');
                        setTimeout(() => {
                            bar.classList.add('animated');
                        }, index * 200 + 500);
                    });
                    achievementBarObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.2 }
    );

    const achievementsSection = document.getElementById('achievements');
    if (achievementsSection) achievementBarObserver.observe(achievementsSection);


    // ---- TYPING ANIMATION ----

    const typingTarget = document.getElementById('typing-target');
    const phrases = [
        'Full-Stack Developer',
        'UI/UX Enthusiast',
        'Open Source Contributor',
        'Problem Solver',
        'Code Architect',
    ];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 100;

    function typeWriter() {
        const currentPhrase = phrases[phraseIndex];

        if (isDeleting) {
            typingTarget.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typeSpeed = 50;
        } else {
            typingTarget.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typeSpeed = 100;
        }

        if (!isDeleting && charIndex === currentPhrase.length) {
            typeSpeed = 2000; // Pause at end
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typeSpeed = 500; // Pause before typing next
        }

        setTimeout(typeWriter, typeSpeed);
    }

    // Start typing after a short delay
    setTimeout(typeWriter, 1000);


    // ---- NAV HIDE/SHOW ON SCROLL ----

    let lastScrollY = 0;
    const nav = document.getElementById('main-nav');

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 100) {
            nav.classList.add('hidden');
        } else {
            nav.classList.remove('hidden');
        }

        lastScrollY = currentScrollY;
    }, { passive: true });


    // ---- SMOOTH NAV SCROLL ----

    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });


    // ---- SKILL PILL HOVER EFFECT — GLOW TRAIL ----

    document.querySelectorAll('.skill-pill').forEach((pill) => {
        pill.addEventListener('mouseenter', () => {
            const level = pill.dataset.level;
            pill.style.setProperty('--progress', level + '%');
        });
    });


    // ---- CONTACT FORM (Web3Forms) ----

    const form = document.getElementById('contact-form');
    const submitBtn = document.getElementById('submit-btn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnText = submitBtn.querySelector('.btn-text');

            // Show sending state
            btnText.textContent = 'Sending...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            try {
                const formData = new FormData(form);
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();

                if (result.success) {
                    btnText.textContent = 'Message sent ✓';
                    submitBtn.style.borderColor = 'rgba(40, 200, 64, 0.5)';
                    submitBtn.style.background = 'rgba(40, 200, 64, 0.12)';
                    form.reset();
                } else {
                    btnText.textContent = 'Error — Try again';
                    submitBtn.style.borderColor = 'rgba(255, 60, 60, 0.5)';
                    submitBtn.style.background = 'rgba(255, 60, 60, 0.12)';
                }
            } catch (err) {
                btnText.textContent = 'Network error';
                submitBtn.style.borderColor = 'rgba(255, 60, 60, 0.5)';
                submitBtn.style.background = 'rgba(255, 60, 60, 0.12)';
            }

            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';

            setTimeout(() => {
                btnText.textContent = 'Send Message';
                submitBtn.style.borderColor = '';
                submitBtn.style.background = '';
            }, 3000);
        });
    }


    // ---- SITE STATUS INDICATOR ----
    // Green = hosted/online, Yellow = under update
    // Auto-detects hosting status: green if actually deployed, yellow if localhost

    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    function setSiteStatus(status) {
        if (!statusDot || !statusText) return;

        statusDot.classList.remove('hosted', 'updating');

        if (status === 'hosted') {
            statusDot.classList.add('hosted');
            statusText.textContent = 'online';
        } else if (status === 'updating') {
            statusDot.classList.add('updating');
            statusText.textContent = 'updating';
        }
    }

    // Auto-detect: if served from localhost/127.0.0.1/file://, it's under update
    // If served from a real domain, it's hosted (online)
    function detectHostingStatus() {
        const host = window.location.hostname;
        const protocol = window.location.protocol;

        if (protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
            setSiteStatus('updating');
        } else {
            setSiteStatus('hosted');
        }
    }

    detectHostingStatus();

    // Expose globally so you can manually call setSiteStatus('hosted') or setSiteStatus('updating')
    window.setSiteStatus = setSiteStatus;


    // ---- PARALLAX TILT ON CARDS ----

    document.querySelectorAll('.glass-card').forEach((card) => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / centerY * -4;
            const rotateY = (x - centerX) / centerX * 4;

            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)';
        });
    });

})();
