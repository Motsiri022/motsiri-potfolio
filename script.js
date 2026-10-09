document.addEventListener('DOMContentLoaded', () => {
  initSubtle3DBackground();
  initSmoothScroll();
  initScrollAnimations();
  initMobileMenu();
});

function initSubtle3DBackground() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio, 2);

  /* ------------------------------------------------------------------
     LAYERING
     - The main canvas is fixed to the viewport and sits BEHIND all page
       content (z-index: -1). It is only visible where a section has a
       transparent background (hero + white sections).
     - Images, placeholders and the profile photo are opaque, so the 3D
       lines never draw on top of them.
     - Black sections get their own clipped copy with light lines, so the
       effect continues across the whole website.
  ------------------------------------------------------------------ */

  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '-1',
    opacity: '1',
    pointerEvents: 'none'
  });

  // Let the dark lines show through the white areas
  document.querySelectorAll('.hero, .section--white').forEach(el => {
    el.style.backgroundColor = 'transparent';
  });

  // --- Shared geometry -------------------------------------------------
  const geometry = new THREE.SphereGeometry(6.5, 28, 28);
  const wireframeGeometry = new THREE.WireframeGeometry(geometry);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 11;

  // Dark-line scene (for white areas)
  const sceneDark = new THREE.Scene();
  const matDark = new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.09 });
  const sphereDark = new THREE.LineSegments(wireframeGeometry, matDark);
  sceneDark.add(sphereDark);

  // Light-line scene (for black areas)
  const sceneLight = new THREE.Scene();
  const matLight = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
  const sphereLight = new THREE.LineSegments(wireframeGeometry, matLight);
  sceneLight.add(sphereLight);

  // --- Renderers -------------------------------------------------------
  const rendererDark = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  rendererDark.setPixelRatio(dpr);
  rendererDark.setSize(window.innerWidth, window.innerHeight, false);

  // Off-screen renderer for the light lines (copied into the black sections)
  const lightCanvas = document.createElement('canvas');
  const rendererLight = new THREE.WebGLRenderer({ canvas: lightCanvas, alpha: true, antialias: true });
  rendererLight.setPixelRatio(dpr);
  rendererLight.setSize(window.innerWidth, window.innerHeight, false);

  // --- Black sections: clipped, fixed copies of the light render --------
  const blackSections = Array.from(document.querySelectorAll('.section--black, .footer'));
  const blackLayers = blackSections.map(section => {
    section.style.clipPath = 'inset(0)'; // clips the fixed canvas to this section only

    const layer = document.createElement('canvas');
    Object.assign(layer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '0',
      pointerEvents: 'none'
    });
    section.insertBefore(layer, section.firstChild);

    // Keep section content above the effect
    const inner = section.querySelector('.section__inner');
    if (inner) {
      inner.style.position = 'relative';
      inner.style.zIndex = '1';
    }

    return { section, layer, ctx: layer.getContext('2d'), visible: true };
  });

  function sizeLayers() {
    blackLayers.forEach(item => {
      item.layer.width = lightCanvas.width;
      item.layer.height = lightCanvas.height;
    });
  }
  sizeLayers();

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const item = blackLayers.find(b => b.section === entry.target);
        if (item) item.visible = entry.isIntersecting;
      });
    });
    blackLayers.forEach(item => io.observe(item.section));
  }

  // --- Placement: centered, large sphere --------------------------------
  function positionSphere() {
    // Centered, full-size sphere (same scale as the original)
    sphereDark.position.set(0, 0, 0);
    sphereLight.position.set(0, 0, 0);

    if (window.innerWidth > 992) {
      matDark.opacity = 0.11;
      matLight.opacity = 0.14;
    } else {
      matDark.opacity = 0.08;
      matLight.opacity = 0.1;
    }
  }
  positionSphere();

  // --- Gentle mouse parallax -------------------------------------------
  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.00012;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.00012;
  });

  // --- Render ----------------------------------------------------------
  function renderFrame() {
    rendererDark.render(sceneDark, camera);

    const anyBlackVisible = blackLayers.some(b => b.visible);
    if (anyBlackVisible) {
      rendererLight.render(sceneLight, camera);
      blackLayers.forEach(item => {
        if (!item.visible) return;
        item.ctx.clearRect(0, 0, item.layer.width, item.layer.height);
        item.ctx.drawImage(lightCanvas, 0, 0);
      });
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    targetX += (mouseX - targetX) * 0.04;
    targetY += (mouseY - targetY) * 0.04;

    sphereDark.rotation.y += 0.0006 + targetX * 0.2;
    sphereDark.rotation.x += 0.0003 + targetY * 0.2;
    sphereLight.rotation.copy(sphereDark.rotation);

    renderFrame();
  }

  if (reduceMotion) {
    renderFrame();
  } else {
    animate();
  }

  // --- Resize ----------------------------------------------------------
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rendererDark.setSize(w, h, false);
    rendererLight.setSize(w, h, false);
    sizeLayers();
    positionSphere();
    if (reduceMotion) renderFrame();
  });
}

function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') {
        e.preventDefault(); // placeholder links should not jump to the top
        return;
      }

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
}

function initScrollAnimations() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  // Elements to reveal, with an optional direction
  const groups = [
    { selector: '.hero__title' },
    { selector: '.hero__media-container', dir: 'left' },
    { selector: '.hero__content', dir: 'right' },
    { selector: '.stat-card' },
    { selector: '.section-header' },
    { selector: '.project-card' },
    { selector: '.service-item' },
    { selector: '.about-grid > div:first-child', dir: 'left' },
    { selector: '.about-grid > div:last-child', dir: 'right' },
    { selector: '.footer__main > div:first-child', dir: 'left' },
    { selector: '.footer__main > div:last-child', dir: 'right' },
    { selector: '.footer__bottom' }
  ];

  const targets = [];
  groups.forEach(group => {
    document.querySelectorAll(group.selector).forEach((el, index) => {
      el.classList.add('reveal');
      if (group.dir === 'left') el.classList.add('reveal--left');
      if (group.dir === 'right') el.classList.add('reveal--right');

      // Stagger siblings (e.g. project cards in the same row)
      el.style.transitionDelay = ((index % 3) * 0.12) + 's';
      targets.push(el);
    });
  });

  // Count-up for the stat numbers
  function countUp(el) {
    const match = el.textContent.trim().match(/^(\d+)(.*)$/);
    if (!match) return;
    const finalValue = parseInt(match[1], 10);
    const width = match[1].length;
    const suffix = match[2];
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(finalValue * eased);
      el.textContent = String(value).padStart(width, '0') + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-visible');

      const statValue = el.querySelector && el.querySelector('.stat-card__value');
      if (statValue) countUp(statValue);

      observer.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => observer.observe(el));
}

function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('primary-nav');
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-open'));
  });

  // Close after choosing a link
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setOpen(false));
  });

  // Close on Escape or when tapping outside the header
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.site-header')) setOpen(false);
  });

  // Reset when returning to desktop width
  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) setOpen(false);
  });
}