
     const FUNCTIONS_BASE_URL = (window.ENV?.FUNCTIONS_BASE_URL || '').replace(/\/$/, '');

    async function callFn(fn, opts = {}) {
      if (!FUNCTIONS_BASE_URL) {
        showToast('Configura env.js con FUNCTIONS_BASE_URL.', 'info');
        throw new Error('FUNCTIONS_BASE_URL no configurado');
      }
      const method = opts.method || 'POST';
      const res = await fetch(`${FUNCTIONS_BASE_URL}/${fn}`, {
        method,
        headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(opts.body || {})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
      return data;
    }

    let state = {
      staff: [],
      activeStaff: null,
      adminToken: null,
      rewards: [],
      clients: [],
      paquetes: [],
      promosSemanales: [],  
      promosAsignadas: [],
      cardStyle: 'plum',
      cardImageUrl: ''
    };

    let activeClientAdmin = null;
    let html5QrScanner = null;
    let estiloPollingInterval = null;

    const CARD_STYLES = {
      plum: { label: 'Orquídea Soft', desc: 'Elegante y claro',       emoji: '🌷', gradient: 'linear-gradient(135deg, #f7f0f6 0%, #eef6f2 100%)' },
      pink: { label: 'Rosa Suave',    desc: 'Cálido y femenino',      emoji: '🌸', gradient: 'linear-gradient(135deg, #fbeef2 0%, #f5e5ed 100%)' },
      gold: { label: 'Menta Fresca',  desc: 'Fresco y natural',       emoji: '🌿', gradient: 'linear-gradient(135deg, #eef6f2 0%, #dceee7 100%)' },
      dark: { label: 'Nube Gris',     desc: 'Moderno y neutro',       emoji: '☁️', gradient: 'linear-gradient(135deg, #f2f1f3 0%, #e4e3e6 100%)' },
      foto: { label: 'Foto personalizada', desc: 'Tu propia imagen de fondo', emoji: '📷', gradient: null }
    };

    const CARD_STYLE_COLUMNS = {
      plum: 'es_plum',
      pink: 'es_pink',
      gold: 'es_gold',
      dark: 'es_dark',
      foto: 'es_foto'
    };

    function estiloActivoDesdeFila(row) {
      const orden = ['plum', 'pink', 'gold', 'dark', 'foto'];
      const activo = orden.find(key => row[CARD_STYLE_COLUMNS[key]] === true);
      return activo || 'plum';
    }

    let previewStyle = 'plum';
    let previewImageUrl = '';

    window.onload = async function() {
      lucide.createIcons();
      if (!FUNCTIONS_BASE_URL) {
        showToast('Configura env.js con FUNCTIONS_BASE_URL.', 'info');
        return;
      }
      await cargarDatosIniciales();
    };

    async function cargarDatosIniciales() {
      try {
        await Promise.all([cargarRecompensas(), cargarEstiloTarjeta()]);
        renderClientRewardsList();
        suscribirEstiloTarjetaRealtime();
      } catch (error) {
        console.error(error);
        showToast('No fue posible cargar los datos.', 'error');
      }
    }

    function buildBackgroundCss(styleKey, imageUrl) {
      if (styleKey === 'foto') {
        if (imageUrl) {
          const safeUrl = imageUrl.replace(/'/g, "%27");
          return `linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.5) 100%), url('${safeUrl}')`;
        }
        return CARD_STYLES.plum.gradient;
      }
      return (CARD_STYLES[styleKey] || CARD_STYLES.plum).gradient;
    }

    async function cargarEstiloTarjeta() {
      if (!FUNCTIONS_BASE_URL) return;
      try {
        const data = await callFn('get-card-style', { method: 'GET' });
        if (data && Object.keys(data).length) {
          state.cardStyle = estiloActivoDesdeFila(data);
          state.cardImageUrl = data.imagen_url || '';
        }
      } catch (error) {
        console.error(error);
      }
      previewStyle = state.cardStyle;
      previewImageUrl = state.cardImageUrl;
      aplicarEstiloAlDOM();
    }

    function aplicarEstiloAlDOM() {
      const panel = document.getElementById('client-card-panel');
      if (panel) {
        panel.style.background = buildBackgroundCss(state.cardStyle, state.cardImageUrl);
        panel.style.backgroundSize = 'cover';
        panel.style.backgroundPosition = 'center';
      }
    }

    function actualizarUrlPreview(url) {
      previewImageUrl = url.trim();
      if (previewStyle === 'foto') {
        renderEstiloOptions();
        renderEstiloPreviewCard();
      }
    }

    function renderEstiloOptions() {
      const grid = document.getElementById('estilo-options-grid');
      const inputUrl = document.getElementById('input-estilo-imagen-url');

      if (inputUrl && !inputUrl.value && (previewImageUrl || state.cardImageUrl)) {
        inputUrl.value = previewImageUrl || state.cardImageUrl;
      }

      if (!grid) return;
      grid.innerHTML = Object.entries(CARD_STYLES).map(([key, s]) => {
        const bg = buildBackgroundCss(key, key === 'foto' ? (previewImageUrl || state.cardImageUrl) : null);
        const desc = (key === 'foto' && !(previewImageUrl || state.cardImageUrl)) ? 'Pega la URL de tu imagen abajo ⬇️' : s.desc;
        return `
        <button onclick="seleccionarEstiloPreview('${key}')" class="text-left p-4 rounded-2xl border-2 transition-all bg-cover bg-center ${previewStyle === key ? 'border-[var(--gold)] shadow-lg scale-[1.02]' : 'border-white/10 opacity-80 hover:opacity-100'}" style="background-image:${bg}">
          <p class="text-white font-bold text-sm flex items-center gap-1.5 flex-wrap">
            <span>${s.emoji} ${s.label}</span>
            ${state.cardStyle === key ? '<span class="text-[8px] bg-[var(--gold)] text-[#1a0e16] px-1.5 py-0.5 rounded-full font-extrabold">ACTUAL</span>' : ''}
          </p>
          <p class="text-white/70 text-[11px] mt-0.5">${desc}</p>
        </button>`;
      }).join('');
    }

    function seleccionarEstiloPreview(key) {
      previewStyle = key;
      if (key === 'foto') previewImageUrl = document.getElementById('input-estilo-imagen-url')?.value.trim() || state.cardImageUrl || '';
      renderEstiloOptions();
      renderEstiloPreviewCard();
    }

    function renderEstiloPreviewCard() {
      const s = CARD_STYLES[previewStyle];
      const card = document.getElementById('estilo-preview-card');
      if (!card) return;
      card.style.background = buildBackgroundCss(previewStyle, previewImageUrl || state.cardImageUrl);
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = 'center';
      document.getElementById('estilo-preview-badge').innerText = s.label;
      document.getElementById('estilo-preview-emoji').innerText = s.emoji;
      const stampsEl = document.getElementById('estilo-preview-stamps');
      stampsEl.innerHTML = Array.from({ length: 6 }).map((_, idx) => {
        const obtenido = (idx + 1) <= 3;
        return `<div class="aspect-square rounded-lg flex items-center justify-center ${obtenido ? 'bg-[var(--gold)]/30 border border-[var(--gold)]' : 'bg-white/5 border border-dashed border-white/20'}">
          <i data-lucide="${obtenido ? 'sparkles' : 'heart'}" class="w-4 h-4 ${obtenido ? 'text-[var(--gold-light)]' : 'text-white/30'}"></i>
        </div>`;
      }).join('');
      lucide.createIcons();
    }

    function cancelarPreviewEstilo() {
      previewStyle = state.cardStyle;
      previewImageUrl = state.cardImageUrl;
      const inputUrl = document.getElementById('input-estilo-imagen-url');
      if (inputUrl) inputUrl.value = state.cardImageUrl;
      renderEstiloOptions();
      renderEstiloPreviewCard();
    }

    async function aplicarEstiloTarjeta() {
      if (!FUNCTIONS_BASE_URL || !state.adminToken) return showToast('Inicia sesión primero.', 'error');
      const inputUrl = document.getElementById('input-estilo-imagen-url');
      const urlAEnviar = inputUrl ? inputUrl.value.trim() : previewImageUrl;

      if (previewStyle === 'foto' && !urlAEnviar) {
        return showToast('Ingresa una URL de imagen válida.', 'error');
      }

      let row;
      try {
        row = await callFn('update-card-style', {
          body: { token: state.adminToken, estilo: previewStyle, imagenUrl: urlAEnviar || null }
        });
      } catch (error) {
        return showToast(error.message, 'error');
      }

      if (row && Object.keys(row).length) {
        state.cardStyle = estiloActivoDesdeFila(row);
        state.cardImageUrl = row.imagen_url || urlAEnviar || '';
      } else {
        state.cardStyle = previewStyle;
        state.cardImageUrl = urlAEnviar;
      }

      aplicarEstiloAlDOM();
      renderEstiloOptions();
      renderEstiloPreviewCard();
      showToast(`Diseño "${CARD_STYLES[previewStyle].label}" aplicado correctamente`, 'success');
    }

    function suscribirEstiloTarjetaRealtime() {
      if (estiloPollingInterval) return;
      estiloPollingInterval = setInterval(async () => {
        try {
          const row = await callFn('get-card-style', { method: 'GET' });
          if (!row || !Object.keys(row).length) return;
          const nuevoEstilo = estiloActivoDesdeFila(row);
          const nuevaImagen = row.imagen_url || '';
          if (nuevoEstilo === state.cardStyle && nuevaImagen === state.cardImageUrl) return;

          state.cardStyle = nuevoEstilo;
          state.cardImageUrl = nuevaImagen;
          aplicarEstiloAlDOM();
          showToast(`El estilo de tarjeta se actualizó a "${CARD_STYLES[state.cardStyle].label}"`, 'info');
        } catch (error) {
          console.error(error);
        }
      }, 15000);
    }

    function actualizarClienteEnListaLocal(cliente) {
      const idx = state.clients.findIndex(c => c.id === cliente.id);
      if (idx >= 0) state.clients[idx] = cliente; else state.clients.push(cliente);
    }

    async function cargarClientasAdmin() {
      if (!FUNCTIONS_BASE_URL || !state.adminToken) return;
      let data;
      try {
        data = await callFn('list-clients-admin', { body: { token: state.adminToken } });
      } catch (error) {
        showToast(error.message, 'error');
        return;
      }
      state.clients = (data || []).map(mapClientFromDb);
      renderAdminDirectoryTable();
      populateReferrerDropdown();
      renderBirthdayAndReferralModules();
      renderDashboardMetrics();
    }

    async function cargarRecompensas() {
      const data = await callFn('get-rewards', { method: 'GET' });
      state.rewards = (data || []).map(r => ({ visita: r.visita, desc: r.descripcion }));
    }

    function mapClientFromDb(c) {
      return {
        id: c.id,
        codigo: c.codigo_invitacion,
        nombre: c.nombre_completo,
        telefono: c.telefono,
        visitas: Number(c.sellos || 0),
        ultVisita: c.ultima_visita,
        cumple: c.cumpleanos,
        notas: c.notas || '',
        referidaPor: c.referida_por || null,
        paqueteId: c.paquete_id || null,
        paqueteNombre: c.paquete_nombre || null,
        promoActiva: c.promo_activa || null
      };
    }

    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      const bgColors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-rose-600 text-white',
        info: 'bg-[#1c131a] text-[var(--gold-light)] border border-[var(--gold)]/30'
      };
      toast.className = `${bgColors[type] || bgColors.info} px-4 py-3 rounded-2xl shadow-xl text-xs font-bold pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2`;
      toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : '✨'}</span><span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    let currentViewMode = 'client';

    function switchView(mode) {
      const vClient = document.getElementById('view-client');
      const vAdmin = document.getElementById('view-admin');
      const btnC = document.getElementById('btn-mode-client');
      const btnA = document.getElementById('btn-mode-admin');
      const indicator = document.getElementById('mode-switch-indicator');
      currentViewMode = mode;

      if (mode === 'client') {
        vClient.classList.remove('hidden'); vAdmin.classList.add('hidden');
      } else {
        vClient.classList.add('hidden'); vAdmin.classList.remove('hidden');
      }

      const activeBtn = mode === 'client' ? btnC : btnA;
      const inactiveBtn = mode === 'client' ? btnA : btnC;
      activeBtn.classList.add('text-[#1a0e16]', 'font-extrabold');
      activeBtn.classList.remove('text-white/70');
      inactiveBtn.classList.remove('text-[#1a0e16]', 'font-extrabold');
      inactiveBtn.classList.add('text-white/70');

      if (indicator) {
        indicator.style.left = activeBtn.offsetLeft + 'px';
        indicator.style.width = activeBtn.offsetWidth + 'px';
      }
    }

    window.addEventListener('resize', () => {
      const indicator = document.getElementById('mode-switch-indicator');
      const activeBtn = document.getElementById(currentViewMode === 'client' ? 'btn-mode-client' : 'btn-mode-admin');
      if (indicator && activeBtn) {
        indicator.style.left = activeBtn.offsetLeft + 'px';
        indicator.style.width = activeBtn.offsetWidth + 'px';
      }
    });

    function esAdmin() {
      return state.activeStaff && String(state.activeStaff.role || '').toLowerCase() === 'admin';
    }

    // ===== Casillas de PIN + teclado numérico =====
    function getPinBoxes() { return Array.from(document.querySelectorAll('#pin-boxes .pin-box')); }

    function syncPinValue() {
      const boxes = getPinBoxes();
      const value = boxes.map(b => b.value).join('');
      document.getElementById('admin-pin-input').value = value;
      boxes.forEach(b => b.classList.toggle('filled', !!b.value));
    }

    function setPinFeedback(state, message) {
      const card = document.getElementById('pin-login-card');
      const errorText = document.getElementById('pin-error-text');
      card.classList.remove('pin-error', 'pin-success', 'pin-shake');
      if (state === 'error') {
        card.classList.add('pin-error', 'pin-shake');
        errorText.textContent = message || 'PIN incorrecto';
        errorText.classList.remove('hidden');
        setTimeout(() => card.classList.remove('pin-shake'), 450);
      } else if (state === 'success') {
        card.classList.add('pin-success');
        errorText.classList.add('hidden');
      } else {
        errorText.classList.add('hidden');
      }
    }

    function resetPinBoxes(keepFocus = true) {
      const boxes = getPinBoxes();
      boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
      syncPinValue();
      setPinFeedback('idle');
      if (keepFocus && boxes[0]) boxes[0].focus();
    }

    function wirePinBoxes() {
      const boxes = getPinBoxes();
      boxes.forEach((box, idx) => {
        box.addEventListener('input', () => {
          box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
          syncPinValue();
          setPinFeedback('idle');
          if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
          if (box.value && idx === boxes.length - 1) autenticarStaff();
        });
        box.addEventListener('keydown', e => {
          if (e.key === 'Backspace' && !box.value && idx > 0) boxes[idx - 1].focus();
          if (e.key === 'Enter') autenticarStaff();
        });
      });
    }

    function pressKeypadDigit(digit) {
      const boxes = getPinBoxes();
      const target = boxes.find(b => !b.value);
      if (!target) return;
      target.value = digit;
      syncPinValue();
      setPinFeedback('idle');
      const idx = boxes.indexOf(target);
      if (idx < boxes.length - 1) boxes[idx + 1].focus();
      if (idx === boxes.length - 1) autenticarStaff();
    }

    function pressKeypadBackspace() {
      const boxes = getPinBoxes();
      for (let i = boxes.length - 1; i >= 0; i--) {
        if (boxes[i].value) { boxes[i].value = ''; boxes[i].focus(); break; }
      }
      syncPinValue();
      setPinFeedback('idle');
    }

    function togglePinVisibility() {
      const boxes = getPinBoxes();
      const showing = boxes[0]?.type === 'text';
      boxes.forEach(b => b.type = showing ? 'password' : 'text');
      const btn = document.getElementById('pin-visibility-toggle');
      btn.innerHTML = showing
        ? '<i data-lucide="eye" class="w-3.5 h-3.5"></i> Mostrar PIN'
        : '<i data-lucide="eye-off" class="w-3.5 h-3.5"></i> Ocultar PIN';
      lucide.createIcons();
    }

    wirePinBoxes();
    switchView('client');

    // Fondo con leve efecto de paralaje: las manchas de color se
    // mueven un poco siguiendo el cursor, para que el fondo se
    // sienta vivo en vez de una imagen fija. En móvil (sin mouse)
    // simplemente no pasa nada — no hace falta más.
    (function initAuraParallax() {
      const blobs = document.querySelectorAll('#aura-app-decor .aura-blob');
      if (!blobs.length) return;
      let ticking = false;
      let targetX = 0, targetY = 0;
      window.addEventListener('mousemove', (e) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        targetY = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!ticking) {
          requestAnimationFrame(() => {
            blobs.forEach((blob, i) => {
              const depth = 10 + i * 6; // cada mancha se mueve una cantidad distinta (profundidad)
              blob.style.setProperty('--px', `${targetX * depth}px`);
              blob.style.setProperty('--py', `${targetY * depth}px`);
            });
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    })();

    async function autenticarStaff() {
      if (!FUNCTIONS_BASE_URL) return showToast('Configura env.js con FUNCTIONS_BASE_URL.', 'error');
      const pin = document.getElementById('admin-pin-input').value.trim();
      if (pin.length < 4) return; // aún no completa las 4 casillas

      let staff;
      try {
        staff = await callFn('login-pin', { body: { pin } });
      } catch (error) {
        setPinFeedback('error', error.message);
        resetPinBoxes();
        return;
      }
      if (!staff || !staff.token) {
        setPinFeedback('error', 'PIN incorrecto o acceso no configurado.');
        resetPinBoxes();
        return;
      }

      setPinFeedback('success');
      state.adminToken = staff.token;
      state.activeStaff = {
        name: staff.nombre || staff.name || 'Personal',
        role: staff.rol || staff.role || 'staff'
      };

      const inicial = (state.activeStaff.name || '?').trim().charAt(0).toUpperCase();
      document.getElementById('staff-name-display-desktop').innerText = state.activeStaff.name;
      document.getElementById('staff-role-display-desktop').innerText = state.activeStaff.role === 'admin' ? 'Administradora' : 'Staff';
      const avatarEl = document.getElementById('staff-avatar-desktop');
      if (avatarEl) avatarEl.innerText = inicial;
      document.getElementById('staff-name-display-mobile').innerText = state.activeStaff.name;
      document.getElementById('session-status-text').innerText = `Sesión staff: ${state.activeStaff.name}`;

      setTimeout(() => {
        document.getElementById('pin-login-card').classList.add('hidden');
        document.getElementById('admin-panel-content').classList.remove('hidden');
        resetPinBoxes(false);
        
        // INTERSECCIÓN DE CONCIERGE TECNOLÓGICO:
        // Configura los permisos de los páneles según el rol e inicializa los selects dinámicos
        inicializarModulosAvanzados();
        
      }, 350);
      showToast(`¡Bienvenida, ${state.activeStaff.name}!`, 'success');
      await cargarClientasAdmin();
      refreshAdminData();
    }


    async function cerrarSesionStaff() {
      if (FUNCTIONS_BASE_URL && state.adminToken) {
        try { await callFn('logout-admin', { body: { token: state.adminToken } }); } catch (error) { console.error(error); }
      }
      state.adminToken = null;
      state.activeStaff = null;
      state.clients = [];
      activeClientAdmin = null;
      document.getElementById('admin-panel-content').classList.add('hidden');
      document.getElementById('pin-login-card').classList.remove('hidden');
      document.getElementById('admin-client-card').classList.add('hidden');
      resetPinBoxes();
      showToast('Sesión cerrada correctamente.', 'info');
    }

    function switchAdminNav(sectionId) {
      const sections = ['directorio', 'promociones', 'cumpleanos', 'referidos', 'esmaltes', 'personalizacion', 'dashboard'];
      sections.forEach(s => {
        const el = document.getElementById(`admin-section-${s}`);
        const btn = document.getElementById(`nav-btn-${s}`);
        if (el) el.classList.toggle('hidden', s !== sectionId);
        if (btn) {
          if (s === sectionId) {
            btn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full bg-[var(--gold)] text-[#1a0e16] font-bold transition-colors duration-200";
          } else {
            btn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-white/70 hover:bg-white/5 transition-colors duration-200";
          }
        }
      });

      document.querySelectorAll('#admin-nav-mobile .mobile-nav-tab').forEach(tab => {
        const isActive = tab.dataset.navId === sectionId;
        tab.className = `mobile-nav-tab flex-shrink-0 flex flex-col items-center gap-1 px-3.5 py-2 rounded-2xl ${isActive ? 'bg-[var(--gold)] text-[#1a0e16] font-bold' : 'text-white/60'}`;
      });

      if (sectionId === 'promos' || sectionId === 'promociones') renderAdminRewardsList();
      if (sectionId === 'cumple' || sectionId === 'cumpleanos' || sectionId === 'referidos') renderBirthdayAndReferralModules();
      if (sectionId === 'esmaltes' || sectionId === 'personalizacion') {
        previewStyle = state.cardStyle;
        previewImageUrl = state.cardImageUrl;
        renderEstiloOptions();
        renderEstiloPreviewCard();
      }
    }

    function renderAdminDirectoryTable() {
      const tb = document.getElementById('admin-clients-table-body');
      if (!tb) return;
      if (!state.clients.length) {
        tb.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-white/40">No hay clientas registradas.</td></tr>`;
        return;
      }
      tb.innerHTML = state.clients.map(c => {
        const initials = c.nombre.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        const memb = c.visitas >= 6 ? 'Club Onyx VIP' : c.visitas >= 3 ? 'Gold Aura' : 'Onyx Premium';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-3.5 flex items-center gap-2.5 font-bold text-white">
              <div class="w-7 h-7 rounded-full bg-[var(--gold)]/20 text-[var(--gold-light)] flex items-center justify-center font-serif-title text-[10px] flex-shrink-0">${initials}</div>
              <span class="truncate max-w-[110px] sm:max-w-none">${escapeHtml(c.nombre)}</span>
            </td>
            <td class="py-3.5 font-mono text-white/60">${escapeHtml(c.telefono)}</td>
            <td class="py-3.5"><span class="bg-[var(--gold)]/15 text-[var(--gold-light)] px-2.5 py-0.5 rounded-full text-[10px] whitespace-nowrap">${memb}</span></td>
            <td class="py-3.5 font-bold">${c.visitas} / 6</td>
            <td class="py-3.5 text-white/60 truncate max-w-[100px]">${escapeHtml(c.notas || 'Sin preferencia')}</td>
            <td class="py-3.5 text-right"><button onclick="document.getElementById('admin-search-input').value='${escapeJs(c.nombre)}'; buscarClienteAdmin();" class="text-[var(--gold-light)] underline">Ver</button></td>
          </tr>
        `;
      }).join('');
    }

    async function buscarTarjetaClienta() {
      const query = document.getElementById('client-search-input').value.trim();
      const btn = document.getElementById('btn-buscar-tarjeta');
      if (!query) return showToast('Ingresa un código o teléfono', 'error');
      if (!FUNCTIONS_BASE_URL) return showToast('Configura env.js con FUNCTIONS_BASE_URL.', 'error');

      const originalBtnHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-wait');
        btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Buscando…';
        lucide.createIcons();
      }

      let found;
      try {
        found = await callFn('get-client-card', { body: { busqueda: query } });
      } catch (error) {
        showToast('No encontramos tu tarjeta. Solicita registro en recepción.', 'error');
        document.getElementById('client-card-container').classList.add('hidden');
        if (btn) { btn.disabled = false; btn.classList.remove('opacity-60', 'cursor-wait'); btn.innerHTML = originalBtnHtml; lucide.createIcons(); }
        return;
      }
      if (btn) { btn.disabled = false; btn.classList.remove('opacity-60', 'cursor-wait'); btn.innerHTML = originalBtnHtml; lucide.createIcons(); }
      renderClientCard(mapClientFromDb(found));
    }

    function renderClientCard(c) {
      document.getElementById('card-client-name').innerText = c.nombre;
      document.getElementById('card-client-code').innerText = c.codigo;
      document.getElementById('ref-code-input').value = `aura.studio/${escapeHtml(c.codigo).toLowerCase()}`;
      const currentMonth = new Date().getMonth() + 1;
      const clientBdayMonth = c.cumple ? parseInt(String(c.cumple).split('-')[1], 10) : null;
      document.getElementById('badge-cumple').classList.toggle('hidden', currentMonth !== clientBdayMonth);

      const bannerPromo = document.getElementById('banner-promo-activa');
      if (bannerPromo) {
        if (c.promoActiva) {
          document.getElementById('banner-promo-texto').innerText = c.promoActiva;
          bannerPromo.classList.remove('hidden');
          bannerPromo.classList.add('flex');
        } else {
          bannerPromo.classList.add('hidden');
          bannerPromo.classList.remove('flex');
        }
      }

      const nivelTexto = c.visitas >= 6 ? 'CLUB ONYX VIP' : c.visitas >= 3 ? 'GOLD AURA' : 'ONIX PREMIUM';
      document.getElementById('card-client-level').innerText = nivelTexto;

      const grid = document.getElementById('client-stamps-grid');
      grid.innerHTML = '';
      for (let i = 1; i <= 6; i++) {
        const obtenido = i <= c.visitas;
        grid.innerHTML += `<div class="aspect-square rounded-full flex items-center justify-center transition-all duration-300 ${obtenido ? 'bg-[var(--gold)] text-[#1a0e16] shadow-md scale-105 font-bold' : 'bg-black/30 border border-dashed border-white/20 text-white/30'}">
          <span class="text-[10px]">${obtenido ? '✓' : i}</span>
        </div>`;
      }
      const restantes = Math.max(0, 6 - c.visitas);
      document.getElementById('progress-text').innerText = restantes === 0 ? '¡Premio mayor desbloqueado!' : `Faltan ${restantes} visita${restantes > 1 ? 's' : ''} para reclamar tu premio.`;
      const container = document.getElementById('client-card-container');
      container.classList.remove('hidden', 'card-reveal');
      void container.offsetWidth; // fuerza el reflow para reiniciar la animación
      container.classList.add('card-reveal');
      lucide.createIcons();
    }

    function renderClientRewardsList() {
      const list = document.getElementById('client-rewards-list');
      if (!list) return;
      list.innerHTML = state.rewards.map(r => `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10 gap-2">
          <div>
            <p class="font-bold text-white">${escapeHtml(r.desc)}</p>
            <p class="text-[10px] text-white/50">Visita requerida: #${r.visita}</p>
          </div>
          <span class="text-[10px] bg-[var(--gold)]/20 text-[var(--gold-light)] px-3 py-1 rounded-full font-bold whitespace-nowrap">Desbloqueado</span>
        </div>`).join('');
    }

    function copiarCodigoReferida() {
      navigator.clipboard.writeText(document.getElementById('ref-code-input').value);
      showToast('¡Enlace de referido copiado!', 'success');
    }

    function buscarClienteAdmin() {
      const q = document.getElementById('admin-search-input').value.trim().toLowerCase();
      if (!q) return showToast('Ingresa un término de búsqueda', 'error');
      const found = state.clients.find(c =>
        c.nombre.toLowerCase().includes(q) ||
        String(c.codigo).toLowerCase().includes(q) ||
        String(c.telefono).includes(q)
      );
      if (!found) {
        showToast('Clienta no encontrada', 'error');
        document.getElementById('admin-client-card').classList.add('hidden');
        return;
      }
      activeClientAdmin = found;
      renderAdminClientCard(found);
    }

    function renderAdminClientCard(c) {
      document.getElementById('adm-c-nombre').innerText = c.nombre;
      document.getElementById('adm-c-codigo-phone').innerText = `#${c.codigo} • Tel: ${c.telefono}`;
      document.getElementById('adm-c-visitas').innerText = c.visitas;
      document.getElementById('adm-c-ultvisita').innerText = c.ultVisita ? formatearFecha(c.ultVisita) : 'Sin visitas';
      document.getElementById('adm-c-notas').value = c.notas || '';
      const badge = document.getElementById('adm-c-semaforo');
      badge.className = "text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      badge.innerText = "🟢 Activa";

      const infoExtra = document.getElementById('adm-c-info-extra');
      const pqBadge = document.getElementById('adm-c-paquete-badge');
      const promoBadge = document.getElementById('adm-c-promo-badge');
      const anyExtra = !!(c.paqueteNombre || c.promoActiva);
      if (infoExtra) { infoExtra.classList.toggle('hidden', !anyExtra); infoExtra.classList.toggle('flex', anyExtra); }
      if (pqBadge) {
        pqBadge.classList.toggle('hidden', !c.paqueteNombre);
        pqBadge.classList.toggle('inline-flex', !!c.paqueteNombre);
        pqBadge.classList.toggle('items-center', !!c.paqueteNombre);
        if (c.paqueteNombre) document.getElementById('adm-c-paquete-nombre').innerText = c.paqueteNombre;
      }
      if (promoBadge) {
        promoBadge.classList.toggle('hidden', !c.promoActiva);
        promoBadge.classList.toggle('inline-flex', !!c.promoActiva);
        promoBadge.classList.toggle('items-center', !!c.promoActiva);
        if (c.promoActiva) document.getElementById('adm-c-promo-texto').innerText = c.promoActiva;
      }
      lucide.createIcons();
      document.getElementById('admin-client-card').classList.remove('hidden');
    }

    function formatearFecha(fechaStr) {
      const d = new Date(fechaStr);
      if (Number.isNaN(d.getTime())) return String(fechaStr);
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    async function modificarSelloCliente(delta) {
      if (!activeClientAdmin || !FUNCTIONS_BASE_URL || !state.adminToken) return;
      let row;
      try {
        row = await callFn('update-stamp', {
          body: { token: state.adminToken, clienteId: activeClientAdmin.id, delta }
        });
      } catch (error) {
        return showToast(error.message, 'error');
      }
      if (row) {
        activeClientAdmin.visitas = Number(row.sellos || 0);
        actualizarClienteEnListaLocal(activeClientAdmin);
        renderAdminClientCard(activeClientAdmin);
        renderClientCard(activeClientAdmin);
        renderAdminDirectoryTable();
        renderDashboardMetrics();
        showToast(`Sellos actualizados a ${activeClientAdmin.visitas}`, 'success');
      }
    }

    async function guardarNotasCliente() {
      if (!activeClientAdmin || !FUNCTIONS_BASE_URL || !state.adminToken) return;
      const notas = document.getElementById('adm-c-notas').value;
      try {
        await callFn('update-notes', {
          body: { token: state.adminToken, clienteId: activeClientAdmin.id, notas }
        });
      } catch (error) {
        return showToast(error.message, 'error');
      }
      activeClientAdmin.notas = notas;
      actualizarClienteEnListaLocal(activeClientAdmin);
      showToast('Notas guardadas', 'success');
    }

    async function guardarRecompensaCustom() {
      if (!FUNCTIONS_BASE_URL || !state.adminToken) return showToast('Inicia sesión primero.', 'error');
      const visita = Number(document.getElementById('select-edit-visita').value);
      const descripcion = document.getElementById('input-edit-promo').value.trim();
      if (!visita || !descripcion) return showToast('Escribe la descripción de la promoción.', 'error');

      try {
        await callFn('update-reward', { body: { token: state.adminToken, visita, descripcion } });
      } catch (error) {
        return showToast(error.message, 'error');
      }

      const idx = state.rewards.findIndex(r => r.visita === visita);
      if (idx >= 0) state.rewards[idx].desc = descripcion; else state.rewards.push({ visita, desc: descripcion });
      document.getElementById('input-edit-promo').value = '';
      renderAdminRewardsList();
      renderClientRewardsList();
      showToast(`Recompensa de la visita ${visita} actualizada`, 'success');
    }

    function renderAdminRewardsList() {
      const el = document.getElementById('admin-rewards-list');
      if (el) el.innerHTML = state.rewards.map(r => `<div class="p-2.5 bg-black/40 rounded-xl flex justify-between"><span>#${r.visita}: ${escapeHtml(r.desc)}</span></div>`).join('');
    }

    function renderBirthdayAndReferralModules() {
      const currentMonth = new Date().getMonth() + 1;
      const birthdays = state.clients.filter(c => c.cumple && parseInt(String(c.cumple).split('-')) === currentMonth);
      const bBadge = document.getElementById('birthday-count-badge');
      if (bBadge) bBadge.innerText = `${birthdays.length} clientas`;
      const bc = document.getElementById('birthday-clients-list');
      if (bc) {
        bc.innerHTML = birthdays.length ? birthdays.map(c => `
          <div class="flex justify-between items-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div><p class="font-bold text-amber-300">${escapeHtml(c.nombre)} <span class="text-[10px] font-normal text-amber-200/60">(${c.cumple})</span></p></div>
          </div>`).join('') : '<p class="text-white/40 text-center py-2">No hay cumpleaños registrados este mes.</p>';
      }
    }

    async function renderDashboardMetrics() {
      document.getElementById('metric-total-clients').innerText = state.clients.length;
      const currentMonth = new Date().getMonth() + 1;
      const birthdays = state.clients.filter(c => c.cumple && parseInt(String(c.cumple).split('-')) === currentMonth);
      document.getElementById('metric-cumple-count').innerText = birthdays.length;
      document.getElementById('metric-prizes-given').innerText = state.clients.filter(c => c.visitas >= 6).length;
    }

    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
    function escapeJs(v) { return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
    function abrirModalNuevoCliente() { populateReferrerDropdown(); document.getElementById('modal-nuevo-cliente').classList.remove('hidden'); }
    function cerrarModal(id) { document.getElementById(id).classList.add('hidden'); }
    function populateReferrerDropdown() {
      const select = document.getElementById('nc-referente');
      if (select) select.innerHTML = '<option value="">-- No --</option>' + state.clients.map(c => `<option value="${escapeHtml(c.codigo)}">${escapeHtml(c.nombre)} (#${escapeHtml(c.codigo)})</option>`).join('');
    }
    async function guardarNuevoCliente() {
      if (!FUNCTIONS_BASE_URL || !state.adminToken) return showToast('Inicia sesión primero.', 'error');
      const nombre = document.getElementById('nc-nombre').value.trim();
      const telefono = document.getElementById('nc-telefono').value.trim();
      const cumple = document.getElementById('nc-cumple').value || null;
      const referida_por = document.getElementById('nc-referente').value || null;
      const paqueteSelect = document.getElementById('nc-paquete-asignado');
      const paqueteId = paqueteSelect && paqueteSelect.value ? paqueteSelect.value : null;
      if (!nombre || !telefono) return showToast('Escribe nombre y teléfono de la clienta', 'error');

      const codigo = `CL-${crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}`;
      let data;
      try {
        data = await callFn('create-client', {
          body: {
            token: state.adminToken,
            nombre,
            telefono,
            codigo,
            cumpleanos: cumple,
            referidaPor: referida_por,
            paqueteId
          }
        });
      } catch (error) {
        return showToast(error.message, 'error');
      }

      const nuevoCliente = mapClientFromDb(data);
      state.clients.push(nuevoCliente);
      cerrarModal('modal-nuevo-cliente');
      ['nc-nombre','nc-telefono','nc-cumple'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      if (paqueteSelect) paqueteSelect.value = '';
      activeClientAdmin = nuevoCliente;
      renderAdminClientCard(nuevoCliente);
      renderAdminDirectoryTable();
      renderDashboardMetrics();
      showToast(`Clienta registrada con éxito (#${codigo})`, 'success');
    }
    async function abrirModalEscanerQR() { document.getElementById('modal-escaner-qr').classList.remove('hidden'); }
    function cerrarModalEscaner() { document.getElementById('modal-escaner-qr').classList.add('hidden'); }
    function abrirModalWhatsApp() {
      if (!activeClientAdmin) return;
      document.getElementById('wa-client-name').innerText = activeClientAdmin.nombre;
      document.getElementById('modal-whatsapp').classList.remove('hidden');
    }
    function enviarWA(tipo) {
      if (!activeClientAdmin) return;
      const { telefono: tel, nombre } = activeClientAdmin;
      let msg = tipo === 'premio' ? `¡Hola ${nombre}! Estás a un paso de tu premio en AURA.` : tipo === 'reenganche' ? `¡Hola ${nombre}! Te extrañamos en AURA.` : `¡Feliz Cumpleaños, ${nombre}!`;
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
      cerrarModal('modal-whatsapp');
    }

    document.getElementById('client-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') buscarTarjetaClienta(); });
    document.getElementById('admin-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') buscarClienteAdmin(); });
    // (el Enter ahora se maneja por cada casilla del PIN, ver wirePinBoxes)

    function refreshAdminData() { if (activeClientAdmin) renderAdminClientCard(activeClientAdmin); renderDashboardMetrics(); }



// ==========================================
// MOTOR DE PROMOCIONES Y PAQUETES AVANZADOS
// ==========================================

// Inicialización adaptativa según el Rol (Admin / Staff)
async function inicializarModulosAvanzados() {
  const esAdministrador = esAdmin();
  
  // Capturamos todos los controles del nuevo panel
  const inputsAdmin = document.querySelectorAll('#admin-promos-control-panel input, #admin-promos-control-panel select, #btn-guardar-pkg, #btn-lanzar-promo');
  const warningLabel = document.getElementById('admin-only-warning');
  
  // Bloqueo o desbloqueo por rol de seguridad en Frontend
  if (!esAdministrador) {
    inputsAdmin.forEach(el => el.disabled = true);
    warningLabel?.classList.remove('hidden');
  } else {
    inputsAdmin.forEach(el => el.disabled = false);
    warningLabel?.classList.add('hidden');
  }

  // Cargar catálogos dinámicos e inyectar en las maquetas
  await cargarPaquetes();
  rellenarSelectMultiClientas();
  rellenarSelectPaquetesRegistro();
}

// Alternar visibilidad del select múltiple si es promo personalizada o semanal
function toggleSeleccionClientas(tipo) {
  const contenedor = document.getElementById('contenedor-multi-clientas');
  if (tipo === 'especifica') {
    contenedor.classList.remove('hidden');
    rellenarSelectMultiClientas();
  } else {
    contenedor.classList.add('hidden');
  }
}

// Llenar el select múltiple de clientas en el panel de promociones dirigidas
function rellenarSelectMultiClientas() {
  const select = document.getElementById('promo-clientas-select');
  if (!select) return;
  // Mapea la lista global de clientas cargada por cargarClientasAdmin()
  select.innerHTML = state.clients.map(c => 
    `<option value="${c.id}">${escapeHtml(c.nombre)} (${c.telefono})</option>`
  ).join('');
}

// Llenar el desplegable opcional de paquetes en el modal de nueva clienta
function rellenarSelectPaquetesRegistro() {
  const select = document.getElementById('nc-paquete-asignado');
  if (!select) return;
  select.innerHTML = '<option value="">-- Ninguno (Esquema estándar de 6 sellos) --</option>' + 
    state.paquetes.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
}

// Fetch a la API para traer los paquetes estructurados configurados
async function cargarPaquetes() {
  if (!FUNCTIONS_BASE_URL) return;
  try {
    const data = await callFn('get-packages', { method: 'GET' });
    state.paquetes = data || [];
  } catch (err) {
    console.error("Error al cargar catálogo de paquetes: ", err);
    state.paquetes = state.paquetes || [];
    showToast('No se pudo cargar el catálogo de paquetes.', 'error');
  }
  renderizarPaquetesAdmin();
}

// Pintar los paquetes en la lista de revisión del administrador
function renderizarPaquetesAdmin() {
  const lista = document.getElementById('lista-paquetes-admin');
  if (!lista) return;
  if (!state.paquetes.length) {
    lista.innerHTML = '<p class="text-white/40 italic py-1">No hay paquetes adicionales creados.</p>';
    return;
  }
  lista.innerHTML = state.paquetes.map(p => `
    <div class="p-3 bg-black/40 rounded-xl border border-white/10 flex justify-between items-center gap-2">
      <div>
        <p class="font-bold text-[var(--gold-light)]">${escapeHtml(p.nombre)}</p>
        <p class="text-[10px] text-white/50">Visita ${p.v1}: ${escapeHtml(p.desc1)} | Visita ${p.v2}: ${escapeHtml(p.desc2)}</p>
      </div>
      ${esAdmin() ? `<button onclick="eliminarPaquete('${p.id}')" class="text-rose-400 hover:text-rose-500 font-bold px-1.5 text-xs">✕</button>` : ''}
    </div>
  `).join('');
}

// Crear un paquete estructural (Acción exclusiva de Administrador)
async function guardarPaquete() {
  if (!esAdmin()) return showToast('Acceso denegado: Se requiere rol de Administrador', 'error');
  
  const nombre = document.getElementById('pkg-nombre').value.trim();
  const v1 = Number(document.getElementById('pkg-v1').value);
  const desc1 = document.getElementById('pkg-desc1').value.trim();
  const v2 = Number(document.getElementById('pkg-v2').value);
  const desc2 = document.getElementById('pkg-desc2').value.trim();

  if (!nombre || !desc1 || !desc2) {
    return showToast('Por favor, completa todos los campos del paquete.', 'error');
  }

  try {
    const payload = { token: state.adminToken, nombre, v1, desc1, v2, desc2 };
    const nuevoPkg = await callFn('create-package', { body: payload });

    state.paquetes.push(nuevoPkg);
    renderizarPaquetesAdmin();
    rellenarSelectPaquetesRegistro();
    
    // Limpieza de interfaz
    document.getElementById('pkg-nombre').value = '';
    document.getElementById('pkg-desc1').value = '';
    document.getElementById('pkg-desc2').value = '';
    showToast(`¡Paquete "${nombre}" creado exitosamente!`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Lanzar campañas masivas semanales o dirigidas por multiselección
async function lanzarPromocion() {
  if (!esAdmin()) return showToast('Acceso denegado: Se requiere rol de Administrador', 'error');

  const descripcion = document.getElementById('promo-dinamica-desc').value.trim();
  const tipoDestino = document.getElementById('promo-tipo-destino').value;

  if (!descripcion) return showToast('Escribe el detalle o descripción de la promoción', 'error');

  if (tipoDestino === 'semanal') {
    try {
      await callFn('apply-weekly-promo', { body: { token: state.adminToken, descripcion } });
      showToast('🚀 Promoción semanal aplicada globalmente a todas las tarjetas.', 'success');
      document.getElementById('promo-dinamica-desc').value = '';
      await cargarClientasAdmin();
      if (activeClientAdmin) {
        const actualizado = state.clients.find(c => c.id === activeClientAdmin.id);
        if (actualizado) { activeClientAdmin = actualizado; renderAdminClientCard(actualizado); }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else {
    const selectClientas = document.getElementById('promo-clientas-select');
    // Mapea las llaves de las clientas seleccionadas en el elemento select múltiple
    const clientasSeleccionadas = Array.from(selectClientas.selectedOptions).map(opt => opt.value);

    if (!clientasSeleccionadas.length) {
      return showToast('Selecciona al menos una clienta de la lista de selección múltiple.', 'error');
    }

    try {
      await callFn('apply-targeted-promo', { 
        body: { token: state.adminToken, descripcion, clienteIds: clientasSeleccionadas } 
      });
      showToast(`🎯 Campaña personalizada asignada correctamente a ${clientasSeleccionadas.length} clientas.`, 'success');
      
      document.getElementById('promo-dinamica-desc').value = '';
      selectClientas.selectedIndex = -1; // Deseleccionar elementos visualmente
      await cargarClientasAdmin();
      if (activeClientAdmin) {
        const actualizado = state.clients.find(c => c.id === activeClientAdmin.id);
        if (actualizado) { activeClientAdmin = actualizado; renderAdminClientCard(actualizado); }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

// Elimina un paquete de verdad (llama al backend, no solo local)
async function eliminarPaquete(id) {
  if (!esAdmin()) return;
  if (!FUNCTIONS_BASE_URL || !state.adminToken) return showToast('Inicia sesión primero.', 'error');
  try {
    await callFn('delete-package', { body: { token: state.adminToken, id } });
  } catch (error) {
    return showToast(error.message, 'error');
  }
  state.paquetes = state.paquetes.filter(p => p.id !== id);
  renderizarPaquetesAdmin();
  rellenarSelectPaquetesRegistro();
  showToast('Paquete eliminado del catálogo.', 'info');
}
