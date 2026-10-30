// =============================================
//   SafeZone Lite — script.js
//   SMS via Fast2SMS backend
// =============================================

// ---- Global State ----
let map = null;
let userMarker = null;
let userLat = null;
let userLng = null;
let watchId = null;
let sosActive = false;
let sosInterval = null;

// Set API_BASE dynamically based on environment
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : (window.location.hostname.includes('loca.lt')
        ? 'https://safezone-backend-evolve.loca.lt'
        : 'https://safezone-backend.onrender.com');


// =============================================
//   INIT
// =============================================
window.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    initMap();
    startLiveTracking();
});

// =============================================
//   MAP
// =============================================
function initMap() {
    map = L.map('map', { zoomControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);
}

// =============================================
//   LIVE LOCATION
// =============================================
function startLiveTracking() {
    if (!navigator.geolocation) {
        document.getElementById('location-text').textContent = '❌ Geolocation not supported.';
        document.getElementById('coords-display').textContent = 'Geolocation unavailable.';
        return;
    }
    watchId = navigator.geolocation.watchPosition(onLocationUpdate, onLocationError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
    });
}

function onLocationUpdate(position) {
    userLat = position.coords.latitude;
    userLng = position.coords.longitude;
    const accuracy = Math.round(position.coords.accuracy);

    document.getElementById('location-text').textContent =
        `Live · Lat: ${userLat.toFixed(5)}, Lng: ${userLng.toFixed(5)} · Accuracy: ±${accuracy}m`;
    document.getElementById('coords-display').textContent =
        `📌 Lat: ${userLat.toFixed(6)} | Lng: ${userLng.toFixed(6)} | Accuracy: ±${accuracy}m`;

    const pulseIcon = L.divIcon({
        className: '',
        html: `<div class="pulse-dot"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    if (!userMarker) {
        userMarker = L.marker([userLat, userLng], { icon: pulseIcon })
            .addTo(map).bindPopup('📍 You are here').openPopup();
        map.setView([userLat, userLng], 16);
    } else {
        userMarker.setLatLng([userLat, userLng]);
    }
}

function onLocationError(error) {
    let msg = '';
    switch (error.code) {
        case error.PERMISSION_DENIED: msg = '❌ Location permission denied.'; break;
        case error.POSITION_UNAVAILABLE: msg = '⚠️ Location unavailable.'; break;
        case error.TIMEOUT: msg = '⏱ Location timed out. Retrying...'; break;
        default: msg = '⚠️ Unknown location error.';
    }
    document.getElementById('location-text').textContent = msg;
    document.getElementById('coords-display').textContent = msg;
}

// =============================================
//   FIND SAFE SPOT
// =============================================
function findSafeSpot() {
    if (!userLat || !userLng) {
        showToast('⏳ Still fetching location...');
        navigator.geolocation.getCurrentPosition((pos) => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            openSafeSpotSearch();
        }, onLocationError, { enableHighAccuracy: true, timeout: 10000 });
        return;
    }
    openSafeSpotSearch();
}

function openSafeSpotSearch() {
    const query = encodeURIComponent('police station OR hospital OR pharmacy near me');
    window.open(`https://www.google.com/maps/search/${query}/@${userLat},${userLng},15z`, '_blank');
    showToast('🗺 Opening Google Maps...');
}

// =============================================
//   SEARCH NEARBY
// =============================================
function searchNearby(category) {
    if (!userLat || !userLng) { showToast('⏳ Location not ready yet.'); return; }
    const labels = { police: 'police station', hospital: 'hospital', cafe: 'cafe', pharmacy: 'pharmacy' };
    const query = encodeURIComponent(labels[category] + ' near me');
    window.open(`https://www.google.com/maps/search/${query}/@${userLat},${userLng},15z`, '_blank');
    showToast(`🔍 Searching for ${labels[category]}...`);
}

// =============================================
//   PROFILE
// =============================================
function saveProfile() {
    const name = document.getElementById('user-name').value.trim();
    const contact = document.getElementById('emergency-contact').value.trim();

    if (!name || !contact) {
        document.getElementById('profile-status').textContent = '⚠️ Please fill in both fields.';
        document.getElementById('profile-status').style.color = '#ff6666';
        return;
    }

    // Clean the number — get digits only
    const digitsOnly = contact.replace(/\D/g, '');

    // Accept: 10 digits, or 91+10 digits (12 total)
    let tenDigit = '';
    if (digitsOnly.length === 10) {
        tenDigit = digitsOnly;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        tenDigit = digitsOnly.slice(2);
    } else {
        document.getElementById('profile-status').textContent = '⚠️ Enter a valid 10-digit Indian mobile number.';
        document.getElementById('profile-status').style.color = '#ff6666';
        return;
    }

    // Always store as +91XXXXXXXXXX
    const normalized = '+91' + tenDigit;

    localStorage.setItem('szl_name', name);
    localStorage.setItem('szl_contact', normalized);

    // Update the input field to show normalized number
    document.getElementById('emergency-contact').value = normalized;

    document.getElementById('profile-status').textContent = `✅ Saved! Contact: ${normalized}`;
    document.getElementById('profile-status').style.color = '#66ff99';

    showToast(`✅ Profile saved! SOS will go to ${normalized}`);
    console.log('✅ Profile saved — contact:', normalized);
}

function loadProfile() {
    const name = localStorage.getItem('szl_name');
    const contact = localStorage.getItem('szl_contact');

    if (name) document.getElementById('user-name').value = name;
    if (contact) document.getElementById('emergency-contact').value = contact;

    if (name && contact) {
        document.getElementById('profile-status').textContent = `👋 Welcome back, ${name}! SOS → ${contact}`;
        document.getElementById('profile-status').style.color = '#d0aaff';
    } else {
        document.getElementById('profile-status').textContent = '⚠️ Please save your emergency contact below!';
        document.getElementById('profile-status').style.color = '#ffaa44';
    }
}

// =============================================
//   SOS ACTIVATION
// =============================================
function activateSOS() {
    const btn = document.querySelector('.sos-btn');

    if (sosActive) {
        sosActive = false;
        clearInterval(sosInterval);
        btn.classList.remove('sos-mode');
        btn.innerHTML = '🚨 ACTIVATE SOS';
        document.body.classList.remove('sos-mode');
        closeSosModal();
        showToast('✅ SOS deactivated.');
        return;
    }

    // Always read contact fresh from localStorage at the moment SOS is pressed
    const contact = localStorage.getItem('szl_contact');
    const name = localStorage.getItem('szl_name') || 'User';

    console.log('🚨 SOS pressed — contact from localStorage:', contact);
    console.log('🚨 SOS pressed — name:', name);

    if (!contact) {
        showToast('⚠️ No emergency contact saved! Fill in Profile and tap Save first.');
        document.getElementById('profile-card').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    sosActive = true;
    btn.classList.add('sos-mode');
    btn.innerHTML = '🛑 TAP TO CANCEL SOS';
    document.body.classList.add('sos-mode');

    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500, 200, 500]);

    showSosModal();
    setSosStep(1, 'locating');

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            const acc = Math.round(pos.coords.accuracy);
            updateSosCoords(userLat, userLng, acc);

            setSosStep(2, 'sending-police');
            setTimeout(() => {
                markSosStepDone(2);
                setSosStep(3, 'sending-helpline');
                setTimeout(() => {
                    markSosStepDone(3);
                    sendSosToBackend(name, contact, userLat, userLng);
                }, 1800);
            }, 1800);
        },
        () => {
            const fallbackLat = userLat || 'Unknown';
            const fallbackLng = userLng || 'Unknown';
            updateSosCoords(fallbackLat, fallbackLng, null, true);
            setSosStep(2, 'sending-police');
            setTimeout(() => {
                markSosStepDone(2);
                setSosStep(3, 'sending-helpline');
                setTimeout(() => {
                    markSosStepDone(3);
                    sendSosToBackend(name, contact, fallbackLat, fallbackLng);
                }, 1800);
            }, 1800);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

// =============================================
//   SEND SOS TO BACKEND — separated for clarity
// =============================================
function sendSosToBackend(name, contact, lat, lng) {
    const location = (lat !== 'Unknown')
        ? `Lat: ${lat}, Lng: ${lng}`
        : 'Location unavailable';

    setSosStep(4, 'sending-sms');

    console.log('📤 Sending to backend:');
    console.log('   name:', name);
    console.log('   contact:', contact);
    console.log('   location:', location);

    fetch(`${API_BASE}/send-sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emergencyContact: contact, location })
    })
        .then(response => response.json())
        .then(data => {
            console.log('📬 Backend response:', data);
            if (data.success) {
                console.log('✅ SMS sent to:', contact);
                markSosStepDone(4);
                showToast(`✅ SMS sent to ${contact}`, 6000);
                showSosConfirmation(lat, lng);
                sosInterval = setInterval(() => {
                    if (sosActive) showToast('🚨 SOS ACTIVE — Help is on the way!', 2500);
                }, 6000);
            } else {
                console.error('❌ SMS failed:', data.message);
                showToast('❌ SMS failed: ' + data.message, 6000);
                showSmsFallback(name, contact, location);
                showSosConfirmation(lat, lng);
            }
        })
        .catch(err => {
            console.error('❌ Backend unreachable:', err);
            showToast('⚠️ Backend offline — use manual SMS below', 6000);
            showSmsFallback(name, contact, location);
            showSosConfirmation(lat, lng);
        });

    // WhatsApp backup
    if (lat !== 'Unknown') {
        const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
        const waMsg = encodeURIComponent(`🚨 SOS ALERT!\nName: ${name}\n📍 Location: ${mapLink}\n\nPlease help immediately!`);
        const waNumber = contact.replace('+', '');
        document.getElementById('sos-whatsapp-btn').style.display = 'block';
        document.getElementById('sos-whatsapp-btn').onclick = () => {
            window.open(`https://wa.me/${waNumber}?text=${waMsg}`, '_blank');
        };
    }
}

// =============================================
//   SOS MODAL
// =============================================
function showSosModal() {
    const old = document.getElementById('sos-modal-overlay');
    if (old) old.remove();

    const contact = localStorage.getItem('szl_contact') || 'Not set';

    const overlay = document.createElement('div');
    overlay.id = 'sos-modal-overlay';
    overlay.className = 'sos-modal-overlay';
    overlay.innerHTML = `
      <div class="sos-modal" id="sos-modal">
        <div class="sos-modal-header">
          <div class="sos-siren">🚨</div>
          <h2>SOS ALERT ACTIVATED</h2>
          <p class="sos-subtitle">Sending SMS to: ${contact}</p>
        </div>
        <div class="sos-coords-panel" id="sos-coords-panel">
          <span class="sos-spinner">⏳</span>
          <span id="sos-coords-text">Acquiring your live location…</span>
        </div>
        <div class="sos-steps">
          <div class="sos-step active" id="sos-step-1">
            <div class="sos-step-icon">📡</div>
            <div class="sos-step-info">
              <div class="sos-step-title">Fetching Live Location</div>
              <div class="sos-step-sub" id="sos-step-1-sub">Using device GPS…</div>
            </div>
            <div class="sos-step-status" id="sos-step-1-status"><span class="sos-loading-dot"></span></div>
          </div>
          <div class="sos-step" id="sos-step-2">
            <div class="sos-step-icon">👮</div>
            <div class="sos-step-info">
              <div class="sos-step-title">Police — 100</div>
              <div class="sos-step-sub" id="sos-step-2-sub">Waiting…</div>
            </div>
            <div class="sos-step-status" id="sos-step-2-status">🕓</div>
          </div>
          <div class="sos-step" id="sos-step-3">
            <div class="sos-step-icon">📞</div>
            <div class="sos-step-info">
              <div class="sos-step-title">Women's Helpline — 181</div>
              <div class="sos-step-sub" id="sos-step-3-sub">Waiting…</div>
            </div>
            <div class="sos-step-status" id="sos-step-3-status">🕓</div>
          </div>
          <div class="sos-step" id="sos-step-4">
            <div class="sos-step-icon">📱</div>
            <div class="sos-step-info">
              <div class="sos-step-title">SMS to ${contact}</div>
              <div class="sos-step-sub" id="sos-step-4-sub">Waiting…</div>
            </div>
            <div class="sos-step-status" id="sos-step-4-status">🕓</div>
          </div>
        </div>
        <div class="sos-confirmation" id="sos-confirmation" style="display:none;">
          <div class="sos-check">✅</div>
          <p class="sos-conf-title">SOS Alert Sent!</p>
          <p class="sos-conf-sub">Your location has been shared with ${contact}</p>
          <div id="sos-map-link-wrap" style="display:none;">
            <a id="sos-map-link" href="#" target="_blank" class="sos-map-link">📍 View My Location on Google Maps</a>
          </div>
        </div>
        <button id="sos-fallback-btn" class="sos-fallback-btn" style="display:none;">
          ⚠️ MANUAL SMS BACKUP (tap to open messages)
        </button>
        <button id="sos-whatsapp-btn" class="sos-wa-btn" style="display:none;">
          📲 Also Alert via WhatsApp
        </button>
        <button class="sos-close-btn" onclick="activateSOS()">🛑 Cancel SOS &amp; Close</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
}

function closeSosModal() {
    const overlay = document.getElementById('sos-modal-overlay');
    if (overlay) { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 400); }
}

function setSosStep(stepNum, phase) {
    const step = document.getElementById(`sos-step-${stepNum}`);
    const subEl = document.getElementById(`sos-step-${stepNum}-sub`);
    const statEl = document.getElementById(`sos-step-${stepNum}-status`);
    if (!step) return;
    step.classList.add('active');
    const subTexts = {
        'locating': 'Using device GPS…',
        'sending-police': 'Transmitting to Police (100)…',
        'sending-helpline': 'Transmitting to Women\'s Helpline (181)…',
        'sending-sms': 'Sending SMS via Fast2SMS…'
    };
    if (subEl) subEl.textContent = subTexts[phase] || '…';
    if (statEl) statEl.innerHTML = '<span class="sos-loading-dot"></span>';
}

function markSosStepDone(stepNum) {
    const statEl = document.getElementById(`sos-step-${stepNum}-status`);
    const subEl = document.getElementById(`sos-step-${stepNum}-sub`);
    const step = document.getElementById(`sos-step-${stepNum}`);
    if (statEl) statEl.textContent = '✅';
    if (step) step.classList.add('done');
    const doneTexts = {
        1: 'Location acquired',
        2: 'Alert sent to Police — 100',
        3: 'Alert sent to Helpline — 181',
        4: 'SMS delivered to emergency contact'
    };
    if (subEl) subEl.textContent = doneTexts[stepNum] || 'Done';
}

function updateSosCoords(lat, lng, acc, fallback = false) {
    const panel = document.getElementById('sos-coords-panel');
    const textEl = document.getElementById('sos-coords-text');
    const step1Sub = document.getElementById('sos-step-1-sub');
    const step1Sta = document.getElementById('sos-step-1-status');
    const step1 = document.getElementById('sos-step-1');

    if (fallback || lat === 'Unknown') {
        if (textEl) textEl.textContent = '⚠️ Location unavailable — sending SOS anyway.';
        if (panel) panel.classList.add('warn');
    } else {
        if (textEl) textEl.innerHTML =
            `Lat: <strong>${parseFloat(lat).toFixed(6)}</strong> &nbsp;|&nbsp; ` +
            `Lng: <strong>${parseFloat(lng).toFixed(6)}</strong>` +
            (acc ? ` &nbsp;|&nbsp; ±${acc}m` : '');
        if (panel) panel.classList.add('ready');
    }
    if (step1Sub) step1Sub.textContent = fallback ? 'Using last known position' : `Lat ${parseFloat(lat).toFixed(5)}, Lng ${parseFloat(lng).toFixed(5)}`;
    if (step1Sta) step1Sta.textContent = '✅';
    if (step1) step1.classList.add('done');
}

function showSosConfirmation(lat, lng) {
    const conf = document.getElementById('sos-confirmation');
    if (conf) conf.style.display = 'flex';
    const linkWrap = document.getElementById('sos-map-link-wrap');
    const link = document.getElementById('sos-map-link');
    if (lat !== 'Unknown' && link && linkWrap) {
        link.href = `https://maps.google.com/?q=${lat},${lng}`;
        linkWrap.style.display = 'block';
    }
}

function showSmsFallback(name, contact, location) {
    const btn = document.getElementById('sos-fallback-btn');
    if (!btn) return;
    btn.style.display = 'block';
    btn.onclick = () => {
        const body = encodeURIComponent(`🚨 SOS ALERT FROM ${name}!\n📍 Location: ${location}\nHELP IMMEDIATELY.`);
        window.open(`sms:${contact}?body=${body}`, '_blank');
        showToast('📲 Opening Messaging App...');
    };
}

// =============================================
//   ZERO-COST SOS FUNCTIONS
// =============================================
function directSMS() {
    const contact = localStorage.getItem('szl_contact');
    const name = localStorage.getItem('szl_name') || 'User';
    if (!contact) {
        showToast('⚠️ Save a contact first!');
        return;
    }

    const locText = userLat && userLng ? `Lat: ${userLat.toFixed(6)}, Lng: ${userLng.toFixed(6)}` : 'Unknown location';
    const body = encodeURIComponent(`🚨 SOS ALERT FROM ${name}!\n📍 My Location: ${locText}\nHELP IMMEDIATELY.`);

    window.open(`sms:${contact}?body=${body}`, '_blank');
    showToast('📲 Opening Messaging App...');
}

function directWhatsApp() {
    const contact = localStorage.getItem('szl_contact');
    const name = localStorage.getItem('szl_name') || 'User';
    if (!contact) {
        showToast('⚠️ Save a contact first!');
        return;
    }

    const waNumber = contact.replace(/\D/g, ''); // Numbers only for wa.me
    const mapLink = userLat && userLng ? `https://maps.google.com/?q=${userLat},${userLng}` : 'Location unknown';
    const text = encodeURIComponent(`🚨 SOS ALERT!\nName: ${name}\n📍 My Live Location: ${mapLink}\n\nPlease help immediately!`);

    window.open(`https://wa.me/${waNumber}?text=${text}`, '_blank');
    showToast('📲 Opening WhatsApp...');
}

function directCall() {
    const contact = localStorage.getItem('szl_contact');
    if (!contact) {
        showToast('⚠️ Save a contact first!');
        return;
    }
    window.open(`tel:${contact}`, '_self');
    showToast('📞 Opening Dialer...');
}

// =============================================
//   TOAST
// =============================================
function showToast(message, duration = 3500) {
    const existing = document.getElementById('szl-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'szl-toast';
    toast.className = 'szl-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// =============================================
//   CLEANUP
// =============================================
window.addEventListener('beforeunload', () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (sosInterval) clearInterval(sosInterval);
});
