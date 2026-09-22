/* ==========================================================
   AURA NAILS · Landing pública + puerta de acceso
   Archivo nuevo, no modifica app.js ni styles.css
   ========================================================== */

let lpSavedScroll = 0;

/* ---------- Inicialización ---------- */
function lpInit() {
  const landing = document.getElementById('landing-page');
  if (!landing) return;

  document.body.classList.add('lp-locked');

  const yearEl = document.getElementById('lp-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Sombra de la barra de navegación al hacer scroll
  const nav = document.getElementById('lp-nav');
  landing.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('lp-nav-scrolled', landing.scrollTop > 12);
  }, { passive: true });

  // Animación de aparición al hacer scroll
  const reveals = landing.querySelectorAll('.lp-reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('lp-in');
          io.unobserve(entry.target);
        }
      });
    }, { root: landing, threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('lp-in'));
  }

  // Cerrar menú móvil al redimensionar a escritorio
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeLpMenu();
  });

  // Cerrar modal con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLoginModal();
      closeLpMenu();
    }
  });

  if (window.lucide) lucide.createIcons();
}

/* ---------- Menú móvil ---------- */
function toggleLpMenu() {
  const nav = document.getElementById('lp-nav');
  if (nav) nav.classList.toggle('lp-menu-open');
}

function closeLpMenu() {
  const nav = document.getElementById('lp-nav');
  if (nav) nav.classList.remove('lp-menu-open');
}

/* ---------- Scroll suave al inicio de la landing ---------- */
function lpScrollTop() {
  const landing = document.getElementById('landing-page');
  if (landing) landing.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Modal de acceso ---------- */
function openLoginModal() {
  const modal = document.getElementById('lp-login-modal');
  if (!modal) return;
  modal.classList.remove('lp-hide');
  document.body.classList.add('lp-locked');
  if (window.lucide) lucide.createIcons();
}

function closeLoginModal() {
  const modal = document.getElementById('lp-login-modal');
  if (modal) modal.classList.add('lp-hide');
  // Solo libera el scroll si la landing sigue visible
  const landing = document.getElementById('landing-page');
  if (landing && !landing.classList.contains('lp-hide')) {
    document.body.classList.add('lp-locked');
  }
}

/* ---------- Entrar a la aplicación ---------- */
function enterApp(role) {
  const landing = document.getElementById('landing-page');
  if (landing) {
    lpSavedScroll = landing.scrollTop;
    landing.classList.add('lp-hide');
  }

  closeLoginModal();
  closeLpMenu();

  if (typeof switchView === 'function') {
    switchView(role === 'staff' ? 'admin' : 'client');
  }

  document.body.classList.remove('lp-locked');
  window.scrollTo(0, 0);

  const back = document.getElementById('lp-back-home');
  if (back) back.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();

  if (typeof showToast === 'function') {
    showToast(
      role === 'staff' ? 'Acceso del personal · Ingresa tu PIN' : 'Bienvenida a tu tarjeta AURA',
      'info'
    );
  }
}

/* ---------- Volver a la landing desde la app ---------- */
function backToLanding() {
  const back = document.getElementById('lp-back-home');
  if (back) back.classList.add('hidden');

  const landing = document.getElementById('landing-page');
  if (!landing) return;

  landing.classList.remove('lp-hide');
  document.body.classList.add('lp-locked');

  // Restaura la posición de scroll previa
  requestAnimationFrame(() => { landing.scrollTop = lpSavedScroll || 0; });

  if (window.lucide) lucide.createIcons();
}

/* ---------- Arranque ---------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', lpInit);
} else {
  lpInit();
}