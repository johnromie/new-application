const loginForm = document.getElementById('employee-login-form');
const loginScreen = document.getElementById('employee-login');
const appScreen = document.getElementById('employee-app');
const navButtons = document.querySelectorAll('.nav-btn');
const toggleButtons = document.querySelectorAll('[data-toggle="password"]');

const empName = document.getElementById('emp-name');
const empMeta = document.getElementById('emp-meta');
const empAvatar = document.getElementById('emp-avatar');
const empAvatar2 = document.getElementById('emp-avatar-2');
const empName2 = document.getElementById('emp-name-2');
const empRole = document.getElementById('emp-role');

const statDays = document.getElementById('stat-days');
const statLate = document.getElementById('stat-late');
const statAbsent = document.getElementById('stat-absent');
const statCards = document.querySelectorAll('.stat-card[data-stat]');
const statModal = document.getElementById('stat-modal');
const statModalTitle = document.getElementById('stat-modal-title');
const statModalSubtitle = document.getElementById('stat-modal-subtitle');
const statModalTable = document.getElementById('stat-modal-table');
const statModalEmpty = document.getElementById('stat-modal-empty');
const closeStatModalBtn = document.getElementById('close-stat-modal');
const gpsConsentModal = document.getElementById('gps-consent-modal');
const closeGpsConsentBtn = document.getElementById('close-gps-consent');
const denyGpsConsentBtn = document.getElementById('deny-gps-consent');
const allowGpsConsentBtn = document.getElementById('allow-gps-consent');

const empTime = document.getElementById('emp-time');
const empDate = document.getElementById('emp-date');
const mapPreview = document.getElementById('map-preview');

const locationName = document.getElementById('location-name');
const locationLat = document.getElementById('location-lat');
const locationLng = document.getElementById('location-lng');
const locationAccuracy = document.getElementById('location-accuracy');
const empLocation = document.getElementById('emp-location');
const gpsStatus = document.getElementById('gps-status');
const openMapCurrentBtn = document.getElementById('open-map-current');
const refreshLocationBtn = document.getElementById('refresh-location');

const timeInAmBtn = document.getElementById('time-in-am'); 
const timeOutAmBtn = document.getElementById('time-out-am'); 
const timeInPmBtn = document.getElementById('time-in-pm'); 
const timeOutPmBtn = document.getElementById('time-out-pm'); 
const gpsRefreshBtn = document.getElementById('gps-refresh'); 
const attendanceNotice = document.getElementById('attendance-notice'); 

const recordsTable = document.getElementById('records-table').querySelector('tbody');
const recordsMonth = document.getElementById('records-month');

const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const takePhotoBtn = document.getElementById('take-photo-btn');
const serverModal = document.getElementById('server-modal');
const serverUrlInput = document.getElementById('server-url');
const websiteUrlInput = document.getElementById('website-url');
const openServerBtn = document.getElementById('open-server-settings');
const closeServerBtn = document.getElementById('close-server-settings');
const cancelServerBtn = document.getElementById('cancel-server-settings');
const saveServerBtn = document.getElementById('save-server-settings');
const openWebsiteLinkBtn = document.getElementById('open-website-link');
const logoutBtn = document.getElementById('logout-btn');
const registerModal = document.getElementById('register-modal');
const openRegisterBtn = document.getElementById('open-register');
const closeRegisterBtn = document.getElementById('close-register');
const cancelRegisterBtn = document.getElementById('cancel-register');
const registerForm = document.getElementById('register-form');
const forgotModal = document.getElementById('forgot-modal');
const openForgotBtn = document.getElementById('open-forgot');
const closeForgotBtn = document.getElementById('close-forgot');
const cancelForgotBtn = document.getElementById('cancel-forgot');
const forgotForm = document.getElementById('forgot-form');
const otpModal = document.getElementById('otp-modal');
const otpForm = document.getElementById('otp-form');
const closeOtpBtn = document.getElementById('close-otp');
const resendOtpBtn = document.getElementById('resend-otp');
const concernModal = document.getElementById('concern-modal');
const openConcernBtn = document.getElementById('open-concern');
const closeConcernBtn = document.getElementById('close-concern');
const cancelConcernBtn = document.getElementById('cancel-concern');
const concernForm = document.getElementById('concern-form');
const reportForm = document.getElementById('daily-report-form');
const reportDateLabel = document.getElementById('report-date-label');
const reportEmpName = document.getElementById('report-emp-name');
const reportEmpPosition = document.getElementById('report-emp-position');
const reportDivision = document.getElementById('report-division');
const reportSection = document.getElementById('report-section');
const reportLogDate = document.getElementById('report-log-date');
const reportLogTimes = document.getElementById('report-log-times');
const reportSubmittedName = document.getElementById('report-submitted-name');
const reportSubmittedPosition = document.getElementById('report-submitted-position');
const concernNotice = document.getElementById('concern-notice');
const reportNotice = document.getElementById('report-notice');
const concernSubmitBtn = concernForm ? concernForm.querySelector('button[type="submit"]') : null;
const reportSubmitBtn = reportForm ? reportForm.querySelector('button[type="submit"]') : null;
const loginStatus = document.getElementById('login-status');
const rememberLogin = document.getElementById('remember-login');

let currentUser = null;
let attendanceCache = [];
let photoData = '';
let pendingOtpEmail = '';
let autoRestoreAttempted = false;
let lastAddress = '';
let lastAddressCoords = null;
let locationDeniedByUserChoice = false;
let locationRequestInFlight = false;
let pendingPhotoCaptureAfterConsent = false;
const reverseGeocodeClientCache = new Map();
const reverseGeocodeClientInflight = new Map();
const REVERSE_GEOCODE_CLIENT_CACHE_TTL_MS = 3 * 60 * 1000;
let attendanceAudioContext = null;
let attendanceAudioPrimed = false;
let attendanceRequestInFlight = false;
let attendanceHtmlAudioPrimed = false;
const attendanceHtmlAudio = { timein: null, timeout: null, error: null };
const LOCATION_UNKNOWN_TEXT = 'Location unavailable';
const LOCATION_DENIED_TEXT = 'Location permission denied';
const PHOTO_PLACEHOLDER_SRC = 'assets/photo-placeholder.svg';
const WAIT_EXACT_LOCATION_TEXT = 'plsss wait Still determining the exact location.';
let gpsConsentChoice = 'pending';
const DISABLE_GPS_PHOTO = true;

function getAttendanceAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!attendanceAudioContext) attendanceAudioContext = new AudioCtx();
  return attendanceAudioContext;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function buildBiometricWavDataUri(sequence, noteMs = 90, gapMs = 28) {
  if (typeof btoa !== 'function' || !Array.isArray(sequence) || !sequence.length) return '';

  const sampleRate = 44100;
  const noteSamples = Math.floor((noteMs / 1000) * sampleRate);
  const gapSamples = Math.floor((gapMs / 1000) * sampleRate);
  const frameCount = (noteSamples + gapSamples) * sequence.length;
  const dataSize = frameCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  sequence.forEach((frequency) => {
    for (let i = 0; i < noteSamples; i += 1) {
      const t = i / sampleRate;
      const envelope = Math.sin((Math.PI * i) / noteSamples);
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.38 * envelope;
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, value * 32767, true);
      offset += 2;
    }
    for (let i = 0; i < gapSamples; i += 1) {
      view.setInt16(offset, 0, true);
      offset += 2;
    }
  });

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function getBiometricToneSet(kind) {
  if (kind === 'timein') return [880, 1046.5, 1318.51];
  if (kind === 'timeout') return [1318.51, 1046.5, 880];
  if (kind === 'error') return [440, 329.63, 261.63];
  return null;
}

function getHtmlAttendanceSound(kind) {
  if (attendanceHtmlAudio[kind]) return attendanceHtmlAudio[kind];
  if (typeof Audio === 'undefined') return null;
  const tones = getBiometricToneSet(kind);
  if (!tones) return null;
  const src = buildBiometricWavDataUri(tones);
  if (!src) return null;

  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = 1;
  attendanceHtmlAudio[kind] = audio;
  return audio;
}

function playHtmlAttendanceSound(kind) {
  const base = getHtmlAttendanceSound(kind);
  if (!base) return false;
  try {
    const audio = base.cloneNode ? base.cloneNode(true) : new Audio(base.src);
    audio.volume = 1;
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {});
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function primeHtmlAttendanceAudio() {
  const sounds = ['timein', 'timeout', 'error'].map((kind) => getHtmlAttendanceSound(kind)).filter(Boolean);
  if (!sounds.length) return false;

  let unlocked = false;
  for (const audio of sounds) {
    try {
      audio.muted = true;
      audio.currentTime = 0;
      await audio.play();
      unlocked = true;
    } catch (err) {
      // Ignore; some platforms still block until a direct gesture.
    } finally {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }
  }
  if (unlocked) attendanceHtmlAudioPrimed = true;
  return unlocked;
}

async function primeAttendanceAudio() {
  const ctx = getAttendanceAudioContext();
  let webReady = false;

  if (ctx) {
    try {
      if (ctx.state !== 'running') await ctx.resume();
      if (ctx.state === 'running') {
        webReady = true;
      }
      if (webReady && !attendanceAudioPrimed) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = ctx.currentTime + 0.01;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(0.0002, at + 0.01);
        gain.gain.linearRampToValueAtTime(0.0001, at + 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.025);
        attendanceAudioPrimed = true;
      }
    } catch (err) {
      webReady = false;
    }
  }

  const htmlReady = attendanceHtmlAudioPrimed || (await primeHtmlAttendanceAudio());
  return webReady || htmlReady;
}

async function playToneSequence(sequence) {
  const ctx = getAttendanceAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state !== 'running') await ctx.resume();
  } catch (err) {
    return false;
  }
  if (ctx.state !== 'running') return false;

  const startAt = ctx.currentTime + 0.02;
  sequence.forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noteStart = startAt + index * 0.14;
    const noteEnd = noteStart + 0.12;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, noteStart);

    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.35, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteEnd + 0.02);
  });
  return true;
}

function vibrateAttendance(kind) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (kind === 'timein') {
    navigator.vibrate([25, 35, 25]);
    return;
  }
  if (kind === 'timeout') {
    navigator.vibrate([35, 50, 35]);
    return;
  }
  if (kind === 'error') {
    navigator.vibrate([50, 40, 50]);
  }
}

function speakAttendanceLabel(kind) {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }

  let text = '';
  if (kind === 'timein') text = 'time in';
  if (kind === 'timeout') text = 'time out';
  if (!text) return false;

  try {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = synth.getVoices ? synth.getVoices() : [];
    const preferredVoice =
      voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith('en-us')) ||
      voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;

    synth.speak(utterance);
    return true;
  } catch (err) {
    return false;
  }
}

async function playAttendanceSound(kind) {
  if (kind === 'timein' || kind === 'timeout') {
    const spoken = speakAttendanceLabel(kind);
    if (spoken) {
      vibrateAttendance(kind);
      return true;
    }
  }

  const tones = getBiometricToneSet(kind);
  if (!tones) return false;

  let played = await playToneSequence(tones);
  if (!played) played = playHtmlAttendanceSound(kind);
  if (!played && !attendanceHtmlAudioPrimed) {
    await primeHtmlAttendanceAudio();
    played = playHtmlAttendanceSound(kind);
  }
  vibrateAttendance(kind);
  return played;
}
const appConfig = typeof window !== 'undefined' && window.APP_CONFIG ? window.APP_CONFIG : {};
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
const defaultApiBase = appConfig.apiBase || '';
const defaultWebsiteUrl = appConfig.websiteUrl || '';
let storedApiBase = localStorage.getItem('apiBase') || '';
let storedWebsiteUrl = localStorage.getItem('websiteUrl') || '';
const storedOverride = localStorage.getItem('apiBaseOverride') === 'true';
const runtimeOrigin =
  typeof window !== 'undefined' &&
  window.location &&
  /^https?:\/\//i.test(window.location.origin || '')
    ? window.location.origin.replace(/\/+$/, '')
    : '';
const isHostedCapacitorRuntime =
  isCapacitor &&
  !!runtimeOrigin &&
  !/^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|10\.0\.2\.2)(?::\d+)?$/i.test(runtimeOrigin);
lastAddress = '';
lastAddressCoords = null;

function normalizeApiUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`.replace(/\/+$/, '');
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`.replace(/\/+$/, '');
  }
  return '';
}

function isLegacyBackendUrl(value) {
  const normalized = normalizeApiUrl(value).toLowerCase();
  if (!normalized) return false;
  return normalized.includes('sdoattendance-monitoring.depedmarinduque.com');
}

function buildWebsiteUrl(baseUrl) {
  const normalized = normalizeApiUrl(baseUrl);
  if (normalized) return `${normalized}/admin/`;
  if (typeof window !== 'undefined' && window.location && /^https?:\/\//i.test(window.location.origin || '')) {
    return `${window.location.origin.replace(/\/+$/, '')}/admin/`;
  }
  return '';
}

if (isLegacyBackendUrl(storedApiBase)) {
  storedApiBase = '';
  localStorage.removeItem('apiBase');
  localStorage.setItem('apiBaseOverride', 'false');
}
if (isLegacyBackendUrl(storedWebsiteUrl)) {
  storedWebsiteUrl = '';
  localStorage.removeItem('websiteUrl');
}

let apiBase = '';
if (isHostedCapacitorRuntime) {
  apiBase = runtimeOrigin;
  localStorage.setItem('apiBase', apiBase);
  localStorage.setItem('apiBaseOverride', 'false');
} else if (isCapacitor) {
  apiBase = storedOverride
    ? (storedApiBase || defaultApiBase || 'http://10.0.2.2:5173')
    : (defaultApiBase || storedApiBase || 'http://10.0.2.2:5173');
} else {
  // Web/iPhone/Android browser mode must stay on same origin as the loaded site.
  apiBase = runtimeOrigin || defaultApiBase || storedApiBase;
}

let websiteUrl = storedWebsiteUrl || defaultWebsiteUrl || buildWebsiteUrl(apiBase);
if (!isCapacitor || isHostedCapacitorRuntime) {
  // Force browser/PWA clients to a single backend to avoid split data.
  if (!apiBase && runtimeOrigin) apiBase = runtimeOrigin;
  localStorage.setItem('apiBase', apiBase);
  localStorage.setItem('apiBaseOverride', 'false');
  websiteUrl = buildWebsiteUrl(apiBase);
  localStorage.setItem('websiteUrl', websiteUrl);
  if (serverUrlInput) serverUrlInput.readOnly = true;
}
serverUrlInput.value = apiBase;
if (websiteUrlInput) websiteUrlInput.value = websiteUrl;
if (rememberLogin) {
  const rememberFlag = localStorage.getItem('rememberLogin');
  rememberLogin.checked = rememberFlag !== 'false';
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function clearLocationCoordinates() {
  locationLat.textContent = '--';
  locationLng.textContent = '--';
  if (locationAccuracy) locationAccuracy.textContent = '--';
}

function setLocationLabel(label) {
  const finalLabel = String(label || '').trim() || LOCATION_UNKNOWN_TEXT;
  if (locationName) locationName.textContent = finalLabel;
  if (empLocation) empLocation.textContent = finalLabel;
}

function resetMapPreview() {
  if (!mapPreview) return;
  mapPreview.src = 'assets/map-placeholder.svg';
}

function setLocationDeniedState() {
  clearLocationCoordinates();
  setLocationLabel(LOCATION_DENIED_TEXT);
  resetMapPreview();
  setGpsStatus('Location denied. Attendance still works without GPS.');
}

function setLocationUnavailableState(message = '') {
  if (!hasActiveGpsFix()) {
    setLocationLabel(LOCATION_UNKNOWN_TEXT);
    resetMapPreview();
    clearLocationCoordinates();
  }
  setGpsStatus(
    message || 'Location temporarily unavailable. Tap GET ACCURATE LOCATION (GPS) to retry.'
  );
}

function hasActiveGpsFix() {
  return !!(normalizeCoordinate(locationLat.textContent) && normalizeCoordinate(locationLng.textContent));
}

function closeGpsConsentModal() {
  if (!gpsConsentModal) return;
  gpsConsentModal.classList.add('hidden');
}

function openGpsConsentModal() {
  if (!gpsConsentModal) {
    gpsConsentChoice = 'allow';
    void requestExactLocation({ source: 'manual' });
    return;
  }
  gpsConsentModal.classList.remove('hidden');
}

async function requestExactLocation({ source = 'manual' } = {}) {
  if (locationRequestInFlight) {
    setGpsStatus(WAIT_EXACT_LOCATION_TEXT);
    if (gpsConsentChoice === 'allow') {
      setAttendanceNotice(WAIT_EXACT_LOCATION_TEXT, 'loading');
    }
    return hasActiveGpsFix();
  }

  locationRequestInFlight = true;
  const waitMessage = WAIT_EXACT_LOCATION_TEXT;
  setGpsStatus(WAIT_EXACT_LOCATION_TEXT);
  if (gpsConsentChoice === 'allow') {
    setAttendanceNotice(waitMessage, 'loading');
  }

  try {
    await updateLocation();
    const gotFix = hasActiveGpsFix();
    if (gpsConsentChoice === 'allow') {
      if (gotFix) {
        setAttendanceNotice('Exact location captured. You can now take photo.', 'success');
      } else {
        setAttendanceNotice(WAIT_EXACT_LOCATION_TEXT, 'loading');
      }
    }
    return gotFix;
  } finally {
    locationRequestInFlight = false;
  }
}

async function handleGpsConsentAllow() {
  closeGpsConsentModal();
  locationDeniedByUserChoice = false;
  gpsConsentChoice = 'allow';
  const shouldCapturePhotoAfterLocation = pendingPhotoCaptureAfterConsent;
  if (String(locationName.textContent || '').trim() === LOCATION_DENIED_TEXT) {
    setLocationUnavailableState('Requesting location permission…');
  }
  const gotFix = await requestExactLocation({
    source: shouldCapturePhotoAfterLocation ? 'photo' : 'manual'
  });

  if (shouldCapturePhotoAfterLocation) {
    if (gotFix || hasActiveGpsFix()) {
      pendingPhotoCaptureAfterConsent = false;
      openPhotoCapture(true);
    } else {
      pendingPhotoCaptureAfterConsent = true;
      setAttendanceNotice(WAIT_EXACT_LOCATION_TEXT, 'loading');
    }
  }
}

function handleGpsConsentDeny() {
  closeGpsConsentModal();
  locationDeniedByUserChoice = true;
  gpsConsentChoice = 'deny';
  const shouldCapturePhotoAfterDeny = pendingPhotoCaptureAfterConsent;
  pendingPhotoCaptureAfterConsent = false;
  stopGpsWatch();
  setLocationDeniedState();
  setAttendanceNotice('Location denied. Attendance still works without GPS.', 'error');
  if (shouldCapturePhotoAfterDeny) {
    openPhotoCapture(true);
  }
}

function initializeLocationState() {
  setLocationLabel(LOCATION_UNKNOWN_TEXT);
  resetMapPreview();
  locationDeniedByUserChoice = false;
  locationRequestInFlight = false;
  pendingPhotoCaptureAfterConsent = false;
  gpsConsentChoice = 'pending';
  clearLocationCoordinates();
  setGpsStatus('Tap GET ACCURATE LOCATION (GPS) to request location permission.');
}

function hasGpsConsentChoice() {
  return gpsConsentChoice === 'allow' || gpsConsentChoice === 'deny';
}

function clearPhotoSelection(resetInput = true) {
  photoData = '';
  if (photoPreview) photoPreview.src = PHOTO_PLACEHOLDER_SRC;
  if (resetInput && photoInput) photoInput.value = '';
}

function remindGpsChoiceBeforePhoto() {
  pendingPhotoCaptureAfterConsent = true;
  alert("Before taking a photo, tap GET ACCURATE LOCATION (GPS) and choose Allow or Don't Allow first.");
  openGpsConsentModal();
}

function openPhotoCapture(force = false) {
  if (!force && !hasGpsConsentChoice()) {
    remindGpsChoiceBeforePhoto();
    return false;
  }

  if (!force && gpsConsentChoice === 'allow' && !hasActiveGpsFix()) {
    pendingPhotoCaptureAfterConsent = true;
    setAttendanceNotice(WAIT_EXACT_LOCATION_TEXT, 'loading');
    if (!locationRequestInFlight) {
      void requestExactLocation({ source: 'photo' });
    }
    return false;
  }

  pendingPhotoCaptureAfterConsent = false;
  clearPhotoSelection(false);
  if (photoInput) {
    photoInput.value = '';
    photoInput.click();
    return true;
  }
  return false;
}

function getAttendanceLocationPayload() {
  if (DISABLE_GPS_PHOTO) {
    return {
      location: '',
      latitude: '',
      longitude: ''
    };
  }
  const locationText = String(locationName.textContent || '').trim();
  const latitude = normalizeCoordinate(locationLat.textContent);
  const longitude = normalizeCoordinate(locationLng.textContent);
  const hasLocationText =
    !!locationText &&
    locationText !== LOCATION_UNKNOWN_TEXT &&
    locationText !== LOCATION_DENIED_TEXT;
  return {
    location: hasLocationText
      ? locationText
      : (locationText === LOCATION_DENIED_TEXT ? LOCATION_DENIED_TEXT : LOCATION_UNKNOWN_TEXT),
    latitude,
    longitude
  };
}

function isoToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function hasAttendance(record) {
  return !!(record.timeInAM || record.timeOutAM || record.timeInPM || record.timeOutPM || record.timeIn || record.timeOut);
}

function isLateMorning(record) {
  const t = record.timeInAM || record.timeIn || '';
  const minutes = timeToMinutes(t);
  return minutes !== null && minutes > 8 * 60;
}

function isLateAfternoon(record) { 
  const t = record.timeInPM || ''; 
  const minutes = timeToMinutes(t); 
  return minutes !== null && minutes > 13 * 60; 
} 

function tickClock() {
  const now = new Date();
  empTime.textContent = formatTime(now);
  empDate.textContent = formatDate(now);
  if (reportDateLabel) reportDateLabel.textContent = `Date: ${formatDate(now)}`;
}

function setView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('hidden', view.id !== viewId);
  });
  navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
}

function setStatusCell(cell, status) {
  if (!cell) return;
  const statusLower = status.toLowerCase();
  cell.classList.remove('status-present', 'status-late', 'status-absent', 'status-recorded', 'status-pending');
  if (statusLower === 'present') cell.classList.add('status-present');
  if (statusLower === 'late') cell.classList.add('status-late');
  if (statusLower === 'absent') cell.classList.add('status-absent');
  if (statusLower === 'recorded') cell.classList.add('status-recorded');
  if (statusLower === 'pending') cell.classList.add('status-pending');
}

function setLoginStatus(message) {
  if (!loginStatus) return;
  if (message) {
    loginStatus.textContent = message;
    loginStatus.classList.remove('hidden');
  } else {
    loginStatus.textContent = '';
    loginStatus.classList.add('hidden');
  }
}

function saveLogin(username, password) {
  localStorage.setItem('lastLogin', JSON.stringify({ username, password }));
  localStorage.setItem('rememberLogin', 'true');
}

function clearSavedLogin() {
  localStorage.removeItem('lastLogin');
  localStorage.removeItem('rememberLogin');
}

function saveActiveSession(user) {
  if (!user) return;
  localStorage.setItem('employeeSession', JSON.stringify({ user, savedAt: Date.now() }));
}

function loadActiveSession() {
  try {
    const raw = localStorage.getItem('employeeSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user || !parsed.user.id) return null;
    return parsed.user;
  } catch (err) {
    return null;
  }
}

function clearActiveSession() {
  localStorage.removeItem('employeeSession');
}

function saveProfile(payload) {
  localStorage.setItem('employeeProfile', JSON.stringify(payload));
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('employeeProfile') || 'null');
  } catch (err) {
    return null;
  }
}

function pickPhoto(item) {
  return item.photoInAM || item.photoInPM || item.photoOutAM || item.photoOutPM || item.photo || '';
}

function pickLocation(item) {
  return item.locationInAM || item.locationInPM || item.locationOutAM || item.locationOutPM || item.location || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeCoordinate(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(5);
}

function buildMapLabel(locationText) {
  const raw = String(locationText || '').trim();
  if (!raw) return '';
  const firstPart = raw.split(',').map((part) => part.trim()).filter(Boolean)[0] || raw;
  return firstPart.slice(0, 60);
}

function buildGoogleMapsUrl(lat, lng, locationText = '') {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  if (!normalizedLat || !normalizedLng) return '';
  const label = buildMapLabel(locationText);
  const queryValue = label
    ? `loc:${normalizedLat},${normalizedLng} (${label})`
    : `${normalizedLat},${normalizedLng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(queryValue)}`;
}

function openMapByCoordinates(lat, lng, locationText = '') {
  const mapUrl = buildGoogleMapsUrl(lat, lng, locationText);
  if (!mapUrl) {
    alert('GPS coordinates are not available yet. Tap Update first.');
    return;
  }
  const opened = window.open(mapUrl, '_blank');
  if (!opened) window.location.href = mapUrl;
}

function renderSlotLocation(slot) {
  if (!slot) return '--';
  const lat = normalizeCoordinate(slot.lat);
  const lng = normalizeCoordinate(slot.lng);
  const locationText = slot.location ? escapeHtml(String(slot.location).slice(0, 80)) : '';
  if (!lat || !lng) {
    if (locationText) return `<div class="gps-cell"><div class="gps-address">${locationText}</div></div>`;
    return '--';
  }
  const mapUrl = buildGoogleMapsUrl(lat, lng, slot.location || '');
  return `
    <div class="gps-cell">
      <div class="gps-coords">${lat}, ${lng}</div>
      ${locationText ? `<div class="gps-address">${locationText}</div>` : ''}
      ${mapUrl ? `<a class="table-map-link" href="${mapUrl}" target="_blank" rel="noopener noreferrer">View Map</a>` : ''}
    </div>
  `;
}

function inferLegacyAttendanceSlot(item) {
  if (!item) return 'amIn';
  if (item.timeOutPM || item.timeOut) return 'pmOut';
  if (item.timeInPM) return 'pmIn';
  if (item.timeOutAM) return 'amOut';
  return 'amIn';
}

function buildAttendanceSlotTimes(item) {
  const values = {
    amIn: item.timeInAM || '',
    amOut: item.timeOutAM || '',
    pmIn: item.timeInPM || '',
    pmOut: item.timeOutPM || ''
  };

  // Legacy compatibility: some records only have timeIn/timeOut (no AM/PM split).
  // Classify by time of day to avoid treating an AM out as a PM out.
  if (!values.amIn && item.timeIn && !values.pmIn) {
    const minutes = timeToMinutes(item.timeIn);
    if (minutes !== null && minutes >= 13 * 60) values.pmIn = item.timeIn;
    else values.amIn = item.timeIn;
  }

  if (!values.amOut && item.timeOut && !values.pmOut) {
    const minutes = timeToMinutes(item.timeOut);
    if (minutes !== null && minutes >= 13 * 60) values.pmOut = item.timeOut;
    else values.amOut = item.timeOut;
  }

  return values;
}

function getSlotInStatus(timeValue, cutoffMinutes) {
  const minutes = timeToMinutes(timeValue);
  if (minutes === null) return '--';
  return minutes > cutoffMinutes ? 'Late' : 'Present';
}

function getSlotOutStatus(timeOut, timeIn) {
  if (!timeOut) return timeIn ? 'Pending' : '--';
  return 'Recorded';
}

function buildAttendanceSlotStatuses(item) { 
  const times = buildAttendanceSlotTimes(item); 
  return { 
    amIn: getSlotInStatus(times.amIn, 8 * 60), 
    amOut: getSlotOutStatus(times.amOut, times.amIn), 
    pmIn: getSlotInStatus(times.pmIn, 13 * 60), 
    pmOut: getSlotOutStatus(times.pmOut, times.pmIn) 
  }; 
} 

function resolveNextAttendanceSlots() {
  const record = getTodayAttendance() || {};
  const times = buildAttendanceSlotTimes(record);
  const amIn = times.amIn || '';
  const amOut = times.amOut || '';
  const pmIn = times.pmIn || '';
  const pmOut = times.pmOut || '';

  const next = {
    timeInSlot: '',
    timeOutSlot: '',
    done: false
  };

  // Sequence: AM In -> AM Out -> PM In -> PM Out
  if (!amIn) {
    next.timeInSlot = 'AM';
    next.timeOutSlot = '';
    return next;
  }
  if (!amOut) {
    next.timeInSlot = '';
    next.timeOutSlot = 'AM';
    return next;
  }
  if (!pmIn) {
    next.timeInSlot = 'PM';
    next.timeOutSlot = '';
    return next;
  }
  if (!pmOut) {
    next.timeInSlot = '';
    next.timeOutSlot = 'PM';
    return next;
  }
  next.done = true;
  return next;
}

function getMinutesNowLocal() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function setAttendanceButtonState(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
}

function getTodaySlotTimes() {
  const record = getTodayAttendance() || {};
  return buildAttendanceSlotTimes(record);
}

function showAlreadyRecordedNotice(action, slot, recordedAt = '') {
  const actionLabel = action === 'timeout' ? 'Time out' : 'Time in';
  const slotLabel = slot === 'PM' ? 'PM' : 'AM';
  const msg = `${actionLabel} already recorded (${slotLabel}${recordedAt ? ` · ${recordedAt}` : ''}).`;
  setAttendanceNotice(msg, 'success');
  alert(msg);
}

function showAttendanceBlocked(message) {
  const msg = String(message || '').trim() || 'Unable to continue.';
  setAttendanceNotice(msg, 'error');
  alert(msg);
}

function updateMarkAttendanceButtons() { 
  if (!timeInAmBtn || !timeOutAmBtn || !timeInPmBtn || !timeOutPmBtn) return; 
  const times = getTodaySlotTimes(); 
  const amInDone = !!times.amIn; 
  const amOutDone = !!times.amOut; 
  const pmInDone = !!times.pmIn; 
  const pmOutDone = !!times.pmOut; 

  const minutesNow = getMinutesNowLocal();
  const allowPm = minutesNow >= 13 * 60; // after 1:00 PM

  // Always show 4 buttons; enable only the next valid action.
  // Recorded buttons stay clickable so they can show "already recorded" notice.
  setAttendanceButtonState(timeInAmBtn, true); 
  setAttendanceButtonState(timeOutAmBtn, amInDone && (!amOutDone || amOutDone)); 

  // PM time-in only after AM out AND after 1:00 PM.
  setAttendanceButtonState(timeInPmBtn, (amInDone && amOutDone && allowPm) || pmInDone); 
  setAttendanceButtonState(timeOutPmBtn, pmInDone && (!pmOutDone || pmOutDone)); 

  // Small UX hint when PM is not yet available.
  if (amInDone && amOutDone && !pmInDone && !allowPm) {
    setAttendanceNotice('Time In (PM) will be available after 1:00 PM.', 'loading');
  }
} 

async function handleTimeInClick(slot, sourceBtn) {
  const safeSlot = slot === 'PM' ? 'PM' : 'AM';
  const times = getTodaySlotTimes();

  if (safeSlot === 'AM' && times.amIn) {
    showAlreadyRecordedNotice('timein', 'AM', times.amIn);
    return;
  }
  if (safeSlot === 'PM' && times.pmIn) {
    showAlreadyRecordedNotice('timein', 'PM', times.pmIn);
    return;
  }

  if (safeSlot === 'PM') {
    const minutesNow = getMinutesNowLocal();
    if (minutesNow < 13 * 60) {
      showAttendanceBlocked('Time In (PM) is available after 1:00 PM.');
      return;
    }
    if (!times.amIn || !times.amOut) {
      showAttendanceBlocked('Please complete Time In/Out (AM) first.');
      return;
    }
  }

  await markTimeIn(safeSlot, sourceBtn);
}

async function handleTimeOutClick(slot, sourceBtn) {
  const safeSlot = slot === 'PM' ? 'PM' : 'AM';
  const times = getTodaySlotTimes();

  if (safeSlot === 'AM' && times.amOut) {
    showAlreadyRecordedNotice('timeout', 'AM', times.amOut);
    return;
  }
  if (safeSlot === 'PM' && times.pmOut) {
    showAlreadyRecordedNotice('timeout', 'PM', times.pmOut);
    return;
  }

  if (safeSlot === 'AM' && !times.amIn) {
    showAttendanceBlocked('Please record Time In (AM) first.');
    return;
  }
  if (safeSlot === 'PM' && !times.pmIn) {
    showAttendanceBlocked('Please record Time In (PM) first.');
    return;
  }

  await markTimeOut(safeSlot, sourceBtn);
}

function buildAttendanceSlotDetails(item) {
  const details = {
    amIn: { photo: item.photoInAM || '', location: item.locationInAM || '', lat: item.latInAM || '', lng: item.lngInAM || '' },
    amOut: { photo: item.photoOutAM || '', location: item.locationOutAM || '', lat: item.latOutAM || '', lng: item.lngOutAM || '' },
    pmIn: { photo: item.photoInPM || '', location: item.locationInPM || '', lat: item.latInPM || '', lng: item.lngInPM || '' },
    pmOut: { photo: item.photoOutPM || '', location: item.locationOutPM || '', lat: item.latOutPM || '', lng: item.lngOutPM || '' }
  };
  const hasSlotPhoto = Object.values(details).some((slot) => !!slot.photo);
  const hasSlotLocation = Object.values(details).some((slot) => !!slot.location);
  const hasSlotGps = Object.values(details).some((slot) => normalizeCoordinate(slot.lat) && normalizeCoordinate(slot.lng));
  const legacySlot = inferLegacyAttendanceSlot(item);
  if (!hasSlotPhoto && item.photo) details[legacySlot].photo = item.photo;
  if (!hasSlotLocation && item.location) details[legacySlot].location = item.location;
  if (!hasSlotGps && item.latitude && item.longitude) {
    details[legacySlot].lat = item.latitude;
    details[legacySlot].lng = item.longitude;
  }
  return details;
}

function renderSlotPhoto(photo, altText) {
  if (!photo) return '--';
  return `<img class="table-photo" src="${photo}" alt="${altText}" />`;
}

async function reverseGeocode(lat, lng) {
  const key = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
  const now = Date.now();
  const cached = reverseGeocodeClientCache.get(key);
  if (cached && Number(cached.expiresAt || 0) > now) {
    return cached.address || '';
  }

  if (reverseGeocodeClientInflight.has(key)) {
    return reverseGeocodeClientInflight.get(key);
  }

  const request = (async () => {
    let address = '';
    try {
      const res = await fetch(`${apiBase}/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) address = data.address;
      }
    } catch (err) {
      address = '';
    }

    if (address) {
      reverseGeocodeClientCache.set(key, {
        address,
        expiresAt: now + REVERSE_GEOCODE_CLIENT_CACHE_TTL_MS
      });
      if (reverseGeocodeClientCache.size > 300) {
        const firstKey = reverseGeocodeClientCache.keys().next().value;
        if (firstKey) reverseGeocodeClientCache.delete(firstKey);
      }
    }
    return address;
  })();

  reverseGeocodeClientInflight.set(key, request);
  try {
    return await request;
  } finally {
    reverseGeocodeClientInflight.delete(key);
  }
}

function updateMapPreview(lat, lng) {
  if (!mapPreview) return;
  mapPreview.onerror = () => {
    mapPreview.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=600x320&markers=${lat},${lng},red-pushpin`;
  };
  mapPreview.src = `${apiBase}/api/map?lat=${lat}&lng=${lng}&ts=${Date.now()}`;
}

function setGpsStatus(message) {
  if (gpsStatus) gpsStatus.textContent = message;
}

function setInlineNotice(el, message, tone = 'loading') {
  if (!el) return;
  const text = typeof message === 'string' ? message.trim() : '';
  el.classList.remove('hidden', 'loading', 'success', 'error');
  if (!text) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.add(tone);
}

let gpsWatchId = null;
let nativeWatchId = null;
let lastCoords = null;
let lastMapAt = 0;
let lastAddressAt = 0;
const ADDRESS_ACCURACY_THRESHOLD = 6;
const ADDRESS_STABLE_HITS = 2;
const BEST_SAMPLE_WINDOW_MS = 8000;
const ADDRESS_MOVE_THRESHOLD_METERS = 8;
const QUICK_LOCATION_TIMEOUT_MS = 7000;
const PRECISE_LOCATION_TIMEOUT_MS = 15000;
let accuracyStreak = 0;
let forceAddressRefresh = false;

function buildCoordinateLocationLabel(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return LOCATION_UNKNOWN_TEXT;
  return `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
}

function buildPlaceLabel(lat, lng, address = '') {
  const coordinateLabel = buildCoordinateLocationLabel(lat, lng);
  const cleanAddress = String(address || '').trim();
  if (
    !cleanAddress ||
    cleanAddress === LOCATION_UNKNOWN_TEXT ||
    cleanAddress === LOCATION_DENIED_TEXT
  ) {
    return `Pinned map location (${coordinateLabel})`;
  }
  return `${cleanAddress} (${coordinateLabel})`;
}

function getNearbyAddressFallback(lat, lng, maxDistanceMeters = 6) {
  if (!lastAddress || !lastAddressCoords) return '';
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return '';
  const moved = distanceMeters(
    { lat: latNum, lng: lngNum },
    { lat: Number(lastAddressCoords.lat), lng: Number(lastAddressCoords.lng) }
  );
  return moved <= maxDistanceMeters ? lastAddress : '';
}

function getCapacitorGeo() {
  if (typeof window === 'undefined') return null;
  if (!window.Capacitor || !window.Capacitor.Plugins) return null;
  return window.Capacitor.Plugins.Geolocation || null;
}

function getNativePermissionStatus(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  return String(result.location || result.coarseLocation || '').toLowerCase();
}

function isNativePermissionGranted(result) {
  const status = getNativePermissionStatus(result);
  return status === 'granted';
}

function isNativePermissionDenied(result) {
  const status = getNativePermissionStatus(result);
  return status === 'denied' || status === 'restricted';
}

function getGeoErrorCode(err) {
  const code = Number(err && (err.code ?? err.errorCode));
  return Number.isFinite(code) ? code : 0;
}

function isPermissionDeniedError(err) {
  if (!err) return false;
  if (getGeoErrorCode(err) === 1) return true;
  const message = String(err.message || err.errorMessage || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('denied') ||
    message.includes('not authorized') ||
    message.includes('permission denied')
  );
}

async function ensureNativePermission(options = {}) {
  const { prompt = true, tryDirect = true } = options;
  const geo = getCapacitorGeo();
  if (!geo) return false;

  const readCurrent = async () => {
    if (typeof geo.checkPermissions !== 'function') return null;
    try {
      return await geo.checkPermissions();
    } catch (err) {
      return null;
    }
  };

  const requestPrompt = async () => {
    if (!prompt || typeof geo.requestPermissions !== 'function') return null;
    try {
      return await geo.requestPermissions();
    } catch (err) {
      return null;
    }
  };

  const tryDirectPosition = async () => {
    if (!tryDirect || typeof geo.getCurrentPosition !== 'function') return false;
    try {
      await geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
      return true;
    } catch (err) {
      return false;
    }
  };

  try {
    const current = await readCurrent();
    if (isNativePermissionGranted(current)) return true;

    const requested = await requestPrompt();
    if (isNativePermissionGranted(requested)) return true;

    const currentAfterPrompt = await readCurrent();
    if (isNativePermissionGranted(currentAfterPrompt)) return true;

    return await tryDirectPosition();
  } catch (err) {
    return await tryDirectPosition();
  }
}

async function isNativePermissionExplicitlyDenied() {
  const geo = getCapacitorGeo();
  if (!geo || typeof geo.checkPermissions !== 'function') return false;
  try {
    const current = await geo.checkPermissions();
    return isNativePermissionDenied(current);
  } catch (err) {
    return false;
  }
}

async function getWebGeolocationPermissionState() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return '';
  }
  try {
    const state = await navigator.permissions.query({ name: 'geolocation' });
    return String((state && state.state) || '').toLowerCase();
  } catch (err) {
    return '';
  }
}

async function isWebPermissionExplicitlyDenied(err) {
  if (getGeoErrorCode(err) !== 1) return false;
  const state = await getWebGeolocationPermissionState();
  return state === 'denied';
}

function getCurrentWebPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function chooseBetterPosition(best, candidate) {
  if (!candidate) return best;
  if (!best) return candidate;
  const bestAcc = best.coords ? best.coords.accuracy : best.accuracy || 9999;
  const candAcc = candidate.coords ? candidate.coords.accuracy : candidate.accuracy || 9999;
  if (candAcc + 0.1 < bestAcc) return candidate;
  return best;
}

function collectBestWebPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let best = null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        best = chooseBetterPosition(best, pos);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
    setTimeout(() => {
      navigator.geolocation.clearWatch(id);
      resolve(best);
    }, BEST_SAMPLE_WINDOW_MS);
  });
}

async function collectBestNativePosition() {
  const geo = getCapacitorGeo();
  if (!geo) return null;
  let best = null;
  let watchId = null;
  try {
    const idResult = await geo.watchPosition(
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0, distanceFilter: 1 },
      (pos, err) => {
        if (err) return;
        best = chooseBetterPosition(best, pos);
      }
    );
    watchId = idResult && typeof idResult === 'object' && 'id' in idResult ? idResult.id : idResult;
  } catch (err) {
    return null;
  }
  await new Promise((resolve) => setTimeout(resolve, BEST_SAMPLE_WINDOW_MS));
  if (watchId !== null) {
    try {
      geo.clearWatch({ id: watchId });
    } catch (err) {
      // ignore
    }
  }
  return best;
}

async function applyLocationUpdate(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const forceRefresh = forceAddressRefresh;
  forceAddressRefresh = false;
  const latValue = latitude.toFixed(6);
  const lngValue = longitude.toFixed(6);
  locationLat.textContent = latValue;
  locationLng.textContent = lngValue;
  if (locationAccuracy) locationAccuracy.textContent = `${Math.round(accuracy)} m`;

  const now = Date.now();
  const moved = lastCoords ? distanceMeters(lastCoords, { lat: latitude, lng: longitude }) : 9999;
  const shouldUpdateMap = moved > 10 || now - lastMapAt > 10000;
  const shouldUpdateAddress = moved > ADDRESS_MOVE_THRESHOLD_METERS || now - lastAddressAt > 15000;

  if (shouldUpdateMap) {
    updateMapPreview(latitude, longitude);
    lastMapAt = now;
  }

  if (accuracy <= ADDRESS_ACCURACY_THRESHOLD) {
    accuracyStreak += 1;
  } else {
    accuracyStreak = 0;
  }

  const currentLabel = String(locationName.textContent || '').trim();
  const needsAddressNow =
    !currentLabel ||
    currentLabel === LOCATION_UNKNOWN_TEXT ||
    currentLabel === LOCATION_DENIED_TEXT ||
    /^Pinned map location \(/i.test(currentLabel) ||
    /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(currentLabel);
  const shouldTryAddress = forceRefresh || shouldUpdateAddress || needsAddressNow;

  if (accuracy > ADDRESS_ACCURACY_THRESHOLD || accuracyStreak < ADDRESS_STABLE_HITS) {
    const fallback = forceRefresh ? '' : getNearbyAddressFallback(latitude, longitude);
    setLocationLabel(buildPlaceLabel(latitude, longitude, fallback));
    if (shouldTryAddress) {
      try {
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          setLocationLabel(buildPlaceLabel(latitude, longitude, address));
          lastAddress = address;
          lastAddressCoords = { lat: latitude, lng: longitude };
        }
      } catch (err) {
        // Keep fallback label while accuracy improves.
      }
      lastAddressAt = now;
    }
    setGpsStatus(`Improving GPS accuracy · ±${Math.round(accuracy)}m (move outdoors)`);
    lastCoords = { lat: latitude, lng: longitude };
    return;
  }

  if (shouldTryAddress) {
    setGpsStatus('Fetching address…');
    try {
      const address = await reverseGeocode(latitude, longitude);
      if (address) {
        setLocationLabel(buildPlaceLabel(latitude, longitude, address));
        lastAddress = address;
        lastAddressCoords = { lat: latitude, lng: longitude };
        setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
      } else {
        const fallback = getNearbyAddressFallback(latitude, longitude);
        if (fallback) {
          setLocationLabel(buildPlaceLabel(latitude, longitude, fallback));
          setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
        } else {
          setLocationLabel(buildPlaceLabel(latitude, longitude));
          setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m (address still resolving)`);
        }
      }
    } catch (err) {
      const fallback = getNearbyAddressFallback(latitude, longitude);
      if (fallback) {
        setLocationLabel(buildPlaceLabel(latitude, longitude, fallback));
        setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
      } else {
        setLocationLabel(buildPlaceLabel(latitude, longitude));
        setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m (address still resolving)`);
      }
    }
    lastAddressAt = now;
  } else {
    setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
  }

  lastCoords = { lat: latitude, lng: longitude };

  if (pendingPhotoCaptureAfterConsent && gpsConsentChoice === 'allow') {
    pendingPhotoCaptureAfterConsent = false;
    setAttendanceNotice('Exact location captured. Opening camera...', 'success');
    openPhotoCapture(true);
  }
}

async function startGpsWatch() {
  const capGeo = getCapacitorGeo();
  if (capGeo) {
    if (nativeWatchId !== null) return;
    const ok = await ensureNativePermission({ prompt: false, tryDirect: false });
    if (!ok) {
      setGpsStatus('GPS watch not started yet. Tap GET ACCURATE LOCATION (GPS).');
      return;
    }
    setGpsStatus('Live GPS started. Waiting for signal…');
    try {
      const idResult = await capGeo.watchPosition(
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0, distanceFilter: 1, minimumUpdateInterval: 1000 },
        (pos, err) => {
          if (err) {
            if (isPermissionDeniedError(err)) {
              if (hasActiveGpsFix()) {
                setGpsStatus('GPS live updates paused. Using your last accurate location.');
                return;
              }
              isNativePermissionExplicitlyDenied().then((denied) => {
                if (denied) {
                  stopGpsWatch();
                  if (locationDeniedByUserChoice) {
                    setLocationDeniedState();
                    return;
                  }
                  setLocationUnavailableState(
                    'Location blocked by phone settings. Enable Location for this app, then tap GET ACCURATE LOCATION (GPS).'
                  );
                  return;
                }
                setGpsStatus('Location temporarily unavailable. Tap GET ACCURATE LOCATION (GPS) to retry.');
              });
              return;
            }
            setGpsStatus('Unable to get GPS. Tap GET ACCURATE LOCATION (GPS) to retry.');
            return;
          }
          applyLocationUpdate(pos);
        }
      );
      nativeWatchId = idResult && typeof idResult === 'object' && 'id' in idResult ? idResult.id : idResult;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        if (hasActiveGpsFix()) {
          setGpsStatus('GPS live updates paused. Using your last accurate location.');
          return;
        }
        const denied = await isNativePermissionExplicitlyDenied();
        if (denied) {
          stopGpsWatch();
          if (locationDeniedByUserChoice) {
            setLocationDeniedState();
            return;
          }
          setLocationUnavailableState(
            'Location blocked by phone settings. Enable Location for this app, then tap GET ACCURATE LOCATION (GPS).'
          );
          return;
        }
        setGpsStatus('Location temporarily unavailable. Tap GET ACCURATE LOCATION (GPS) to retry.');
        return;
      }
      setGpsStatus('Unable to get GPS. Tap GET ACCURATE LOCATION (GPS) to retry.');
    }
    return;
  }
  if (!navigator.geolocation) {
    setGpsStatus('Geolocation not supported on this device.');
    return;
  }
  if (gpsWatchId !== null) return;
  setGpsStatus('Live GPS started. Waiting for signal…');
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      applyLocationUpdate(pos);
    },
    async (err) => {
      if (getGeoErrorCode(err) === 1) {
        if (hasActiveGpsFix()) {
          setGpsStatus('GPS live updates paused. Using your last accurate location.');
          return;
        }
        const denied = await isWebPermissionExplicitlyDenied(err);
        if (denied) {
          stopGpsWatch();
          if (locationDeniedByUserChoice) {
            setLocationDeniedState();
            return;
          }
          setLocationUnavailableState(
            'Location blocked by browser/site settings. Enable Location, then tap GET ACCURATE LOCATION (GPS).'
          );
          return;
        }
        setGpsStatus('Location temporarily unavailable. Tap GET ACCURATE LOCATION (GPS) to retry.');
        return;
      }
      setGpsStatus('Unable to get GPS. Tap Update to retry.');
    },
    { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
  );
}

function stopGpsWatch() {
  const capGeo = getCapacitorGeo();
  if (capGeo && nativeWatchId !== null) {
    try {
      capGeo.clearWatch({ id: nativeWatchId });
    } catch (err) {
      // ignore clear errors
    }
    nativeWatchId = null;
  }
  if (gpsWatchId === null) return;
  navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = null;
}

async function api(path, options = {}, attempt = 0) {
  const target = `${apiBase}${path}`;
  try {
    const res = await fetch(target, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      data = { message: text };
    }
    if (!res.ok) {
      const error = new Error(data.message || 'Request failed');
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    const manualOverride = localStorage.getItem('apiBaseOverride') === 'true';
    if (!manualOverride && defaultApiBase && apiBase !== defaultApiBase) {
      apiBase = defaultApiBase;
      localStorage.setItem('apiBase', apiBase);
      localStorage.setItem('apiBaseOverride', 'false');
      return api(path, options, attempt + 1);
    }
    if (err.name === 'TypeError' && attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api(path, options, attempt + 1);
    }
    throw err;
  }
}

async function loadAttendance() {
  const data = await api(`/api/attendance?employeeId=${currentUser.id}`);
  attendanceCache = data.attendance;
  updateReportContext();
  updateMarkAttendanceButtons();
}

function computeStats() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = attendanceCache.filter((item) => item.date && item.date.startsWith(monthKey));
  const byDate = new Map();
  monthRecords.forEach((item) => {
    if (!byDate.has(item.date)) byDate.set(item.date, item);
  });

  const records = Array.from(byDate.values());
  const attended = records.filter(hasAttendance);
  const totalDays = attended.length;
  const lateCount = attended.filter((rec) => isLateMorning(rec) || isLateAfternoon(rec)).length;
  const daysSoFar = now.getDate();
  const absent = Math.max(daysSoFar - totalDays, 0);

  statDays.textContent = totalDays;
  statLate.textContent = lateCount;
  statAbsent.textContent = absent;
}

function buildMonthDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = now.getDate();
  const dates = [];
  for (let day = 1; day <= days; day += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push(dateStr);
  }
  return dates;
}

function buildEmployeeStatusList(type) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = attendanceCache.filter((item) => item.date && item.date.startsWith(monthKey));
  const byDate = new Map();
  monthRecords.forEach((item) => {
    if (!byDate.has(item.date)) byDate.set(item.date, item);
  });
  const records = Array.from(byDate.values()).filter(hasAttendance);
  const lateRecords = records.filter((rec) => isLateMorning(rec) || isLateAfternoon(rec));
  const allDates = buildMonthDates();

  if (type === 'late') return lateRecords;
  if (type === 'present') return records;

  return allDates
    .filter((date) => !byDate.has(date) || !hasAttendance(byDate.get(date)))
    .map((date) => ({ date, status: 'Absent' }));
}

function renderStatModalRows(list, type) {
  if (!statModalTable) return;
  const tbody = statModalTable.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    if (statModalEmpty) statModalEmpty.classList.remove('hidden');
    return;
  }
  if (statModalEmpty) statModalEmpty.classList.add('hidden');

  list
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .forEach((item) => {
      const row = document.createElement('tr');
      const statusLabel = item.status || (type === 'late' ? 'Late' : type === 'present' ? 'Present' : 'Absent');
      const amIn = item.timeInAM || item.timeIn || '--';
      const pmIn = item.timeInPM || '--';
      row.innerHTML = `
        <td>${item.date || '--'}</td>
        <td class="status-cell">${statusLabel}</td>
        <td>${amIn}</td>
        <td>${pmIn}</td>
      `;
      setStatusCell(row.querySelector('.status-cell'), statusLabel);
      tbody.appendChild(row);
    });
}

function openStatModal(type) {
  if (!statModal) return;
  const labelMap = {
    present: 'Present Days',
    late: 'Late Days',
    absent: 'Absent Days'
  };
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (statModalTitle) statModalTitle.textContent = labelMap[type] || 'Status Details';
  if (statModalSubtitle) statModalSubtitle.textContent = `Coverage: ${monthLabel}`;
  const list = buildEmployeeStatusList(type);
  renderStatModalRows(list, type);
  statModal.classList.remove('hidden');
}

function closeStatModal() {
  if (statModal) statModal.classList.add('hidden');
}

function getTodayAttendance() {
  const today = isoToday();
  return attendanceCache.find((item) => item.date === today) || null;
}

function updateReportContext() {
  if (!currentUser) return;
  if (reportEmpName) reportEmpName.textContent = currentUser.name || '--';
  if (reportEmpPosition) reportEmpPosition.textContent = currentUser.position || 'Staff';
  if (reportSection) reportSection.textContent = currentUser.office || '--';
  if (reportDivision) reportDivision.textContent = 'Office of the Schools Division Superintendent';
  if (reportSubmittedName) reportSubmittedName.textContent = currentUser.name || '--';
  if (reportSubmittedPosition) reportSubmittedPosition.textContent = currentUser.position || 'Staff';

  const record = getTodayAttendance();
  const inAm = record ? (record.timeInAM || record.timeIn || '--') : '--';
  const outAm = record ? (record.timeOutAM || '--') : '--';
  const inPm = record ? (record.timeInPM || '--') : '--';
  const outPm = record ? (record.timeOutPM || record.timeOut || '--') : '--';
  if (reportLogDate) {
    const now = new Date();
    reportLogDate.textContent = formatDate(now);
  }
  if (reportLogTimes) {
    reportLogTimes.innerHTML = `
      <div>AM In: ${inAm}</div>
      <div>AM Out: ${outAm}</div>
      <div>PM In: ${inPm}</div>
      <div>PM Out: ${outPm}</div>
    `;
  }
}

function renderRecords(list) {
  recordsTable.innerHTML = '';
  list.forEach((item) => {
    const times = buildAttendanceSlotTimes(item);
    const slotStatuses = buildAttendanceSlotStatuses(item);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${times.amIn || '--'}</td>
      <td class="status-cell status-am-in">${slotStatuses.amIn}</td>
      <td>${times.amOut || '--'}</td>
      <td class="status-cell status-am-out">${slotStatuses.amOut}</td>
      <td>${times.pmIn || '--'}</td>
      <td class="status-cell status-pm-in">${slotStatuses.pmIn}</td>
      <td>${times.pmOut || '--'}</td>
      <td class="status-cell status-pm-out">${slotStatuses.pmOut}</td>
    `;
    setStatusCell(row.querySelector('.status-am-in'), slotStatuses.amIn);
    setStatusCell(row.querySelector('.status-am-out'), slotStatuses.amOut);
    setStatusCell(row.querySelector('.status-pm-in'), slotStatuses.pmIn);
    setStatusCell(row.querySelector('.status-pm-out'), slotStatuses.pmOut);
    recordsTable.appendChild(row);
  });
}

function filterRecordsByMonth() {
  const monthValue = recordsMonth.value;
  if (!monthValue) {
    renderRecords(attendanceCache);
    return;
  }
  const [year, month] = monthValue.split('-');
  const filtered = attendanceCache.filter((item) => item.date.startsWith(`${year}-${month}`));
  renderRecords(filtered);
}

async function updateLocation() {
  locationDeniedByUserChoice = false;
  forceAddressRefresh = true;
  const capGeo = getCapacitorGeo();
  if (capGeo) {
    setGpsStatus('Requesting location permission…');
    const ok = await ensureNativePermission({ prompt: true, tryDirect: true });
    if (!ok) {
      stopGpsWatch();
      setLocationUnavailableState(
        'Location blocked by phone settings. Enable Location for this app, then tap GET ACCURATE LOCATION (GPS).'
      );
      return false;
    }
    try {
      setGpsStatus(WAIT_EXACT_LOCATION_TEXT);
      void startGpsWatch();
      let pos = null;
      try {
        pos = await capGeo.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: QUICK_LOCATION_TIMEOUT_MS,
          maximumAge: 120000
        });
      } catch (quickErr) {
        pos = null;
      }
      if (!pos) {
        pos = await capGeo.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: PRECISE_LOCATION_TIMEOUT_MS,
          maximumAge: 0
        });
      }
      if (pos) {
        await applyLocationUpdate(pos);
        setGpsStatus(`${WAIT_EXACT_LOCATION_TEXT} ±${Math.round(pos.coords.accuracy)}m`);
      }
      void collectBestNativePosition().then((best) => {
        if (best) applyLocationUpdate(best);
      }).catch(() => {});
      return hasActiveGpsFix();
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        if (hasActiveGpsFix()) {
          setGpsStatus('GPS live updates paused. Using your last accurate location.');
          return true;
        }
        stopGpsWatch();
        setLocationUnavailableState(
          'Location blocked by phone settings. Enable Location for this app, then tap GET ACCURATE LOCATION (GPS).'
        );
        return false;
      }
      setGpsStatus('Unable to get GPS right now. Tap GET ACCURATE LOCATION (GPS) to retry.');
      return false;
    }
    return false;
  }
  if (!navigator.geolocation) {
    setLocationLabel(LOCATION_UNKNOWN_TEXT);
    clearLocationCoordinates();
    resetMapPreview();
    setGpsStatus('Geolocation not supported on this device.');
    return false;
  }
  setGpsStatus('Requesting location permission…');
  try {
    let pos;
    try {
      pos = await getCurrentWebPosition({
        enableHighAccuracy: false,
        timeout: QUICK_LOCATION_TIMEOUT_MS,
        maximumAge: 120000
      });
    } catch (firstErr) {
      const denied = await isWebPermissionExplicitlyDenied(firstErr);
      if (denied) throw firstErr;
      setGpsStatus(WAIT_EXACT_LOCATION_TEXT);
      pos = await getCurrentWebPosition({
        enableHighAccuracy: true,
        timeout: PRECISE_LOCATION_TIMEOUT_MS,
        maximumAge: 0
      });
    }
    if (pos) {
      await applyLocationUpdate(pos);
      setGpsStatus(`${WAIT_EXACT_LOCATION_TEXT} ±${Math.round(pos.coords.accuracy)}m`);
    }
    void startGpsWatch();
    void collectBestWebPosition().then((best) => {
      if (best) applyLocationUpdate(best);
    }).catch(() => {});
    return hasActiveGpsFix();
  } catch (err) {
    if (getGeoErrorCode(err) === 1) {
      if (hasActiveGpsFix()) {
        setGpsStatus('GPS permission changed, but last accurate location is still in use.');
        return true;
      }
      const denied = await isWebPermissionExplicitlyDenied(err);
      if (denied) {
        stopGpsWatch();
        if (locationDeniedByUserChoice) {
          setLocationDeniedState();
          return false;
        }
        setLocationUnavailableState(
          'Location blocked by browser/site settings. Enable Location, then tap GET ACCURATE LOCATION (GPS).'
        );
        return false;
      }
      setGpsStatus('Location temporarily unavailable. Tap GET ACCURATE LOCATION (GPS) to retry.');
      return false;
    }
    setGpsStatus('Location unavailable. Attendance still works without GPS.');
    setLocationLabel(LOCATION_UNKNOWN_TEXT);
    clearLocationCoordinates();
    resetMapPreview();
    return false;
  }
}

function clearLegacyEmployeeCache() {
  try {
    const keys = [
      'confirmedBarangay',
      'barangayPrompted',
      'gpsDenied',
      'gpsPermissionDenied',
      'gpsPermissionState'
    ];
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    // ignore cache cleanup issues
  }
}

function requirePhoto() {
  if (DISABLE_GPS_PHOTO) return true;
  if (photoData) return true;
  if (!hasGpsConsentChoice()) {
    remindGpsChoiceBeforePhoto();
    return false;
  }
  alert('Please take a photo first.');
  openPhotoCapture();
  return false;
}

function setAttendanceNotice(message, tone = 'loading') {
  if (!attendanceNotice) return;
  const text = typeof message === 'string' ? message.trim() : '';
  attendanceNotice.classList.remove('hidden', 'loading', 'success', 'error');
  if (!text) {
    attendanceNotice.textContent = '';
    attendanceNotice.classList.add('hidden');
    return;
  }
  const safeTone = ['loading', 'success', 'error'].includes(tone) ? tone : 'loading';
  attendanceNotice.textContent = text;
  attendanceNotice.classList.add(safeTone);
}

function setAttendanceButtonsLocked(locked, activeBtn = null) { 
  const btns = [timeInAmBtn, timeOutAmBtn, timeInPmBtn, timeOutPmBtn].filter(Boolean);
  if (btns.length === 0) return;

  btns.forEach((btn) => {
    if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
    btn.disabled = locked || btn.disabled;
  });

  if (locked) {
    if (activeBtn && activeBtn.dataset) {
      activeBtn.textContent = 'PLEASE WAIT...';
    }
    return;
  }

  btns.forEach((btn) => {
    btn.textContent = btn.dataset.defaultLabel || btn.textContent;
  });

  // Recompute enabled states after unlocking.
  updateMarkAttendanceButtons();
} 

function pickRecordedTime(result, action) {
  const attendance = result && result.attendance ? result.attendance : null;
  if (!attendance) return '';
  const slot = result.slot === 'PM' ? 'PM' : 'AM';
  if (action === 'timein') {
    return slot === 'PM'
      ? (attendance.timeInPM || attendance.timeIn || '')
      : (attendance.timeInAM || attendance.timeIn || '');
  }
  return slot === 'PM'
    ? (attendance.timeOutPM || attendance.timeOut || '')
    : (attendance.timeOutAM || attendance.timeOut || '');
}

async function markTimeIn(slot, sourceBtn) { 
  if (attendanceRequestInFlight) { 
    setAttendanceNotice('Please wait... your previous attendance request is still processing.', 'loading'); 
    return; 
  } 
  setAttendanceNotice('Please wait... preparing Time In.', 'loading'); 
  void primeAttendanceAudio(); 
  void playAttendanceSound('timein'); 
  if (!requirePhoto()) { 
    setAttendanceNotice('Unable to continue Time In.', 'error'); 
    return; 
  } 
  if (!currentUser || !currentUser.id) { 
    void playAttendanceSound('error'); 
    setAttendanceNotice('Please log in first before Time In.', 'error'); 
    alert('Please log in first.'); 
    return; 
  } 
 
  attendanceRequestInFlight = true; 
  setAttendanceButtonsLocked(true, sourceBtn || null); 
  setAttendanceNotice('Please wait... recording your Time In.', 'loading'); 
  const locationPayload = getAttendanceLocationPayload(); 
  const payload = { 
    employeeId: currentUser.id, 
    timeIn: timeNow(), 
    date: isoToday(), 
    useServerTime: true, 
    slot: String(slot || '').trim() || undefined, 
    location: locationPayload.location, 
    latitude: locationPayload.latitude, 
    longitude: locationPayload.longitude, 
    photo: photoData 
  }; 
  try {
    const result = await api('/api/attendance/timein', { method: 'POST', body: JSON.stringify(payload) });
    clearPhotoSelection();
    setAttendanceNotice('Time in recorded. Updating records...', 'loading');
    loadAttendance()
      .then(() => {
        computeStats();
        filterRecordsByMonth();
      })
      .catch(() => {
        // background refresh failed; keep success notice
      });
    const slotLabel = result.slot === 'PM' ? 'Afternoon' : 'Morning';
    const recordedAt = pickRecordedTime(result, 'timein');
    const successMessage = `Time in recorded (${slotLabel}${recordedAt ? ` · ${recordedAt}` : ''}).`;
    setAttendanceNotice(successMessage, 'success');
    alert(successMessage);
  } catch (err) { 
    void playAttendanceSound('error'); 
    if (err && err.status === 409) {
      const times = getTodaySlotTimes();
      const recordedAt = slot === 'PM' ? (times.pmIn || '') : (times.amIn || '');
      showAlreadyRecordedNotice('timein', slot === 'PM' ? 'PM' : 'AM', recordedAt);
    } else {
      const errorMessage = err.message || 'Time in failed.'; 
      setAttendanceNotice(errorMessage, 'error'); 
      alert(errorMessage); 
    }
  } finally {  
    attendanceRequestInFlight = false;  
    setAttendanceButtonsLocked(false);  
  }  
}  

async function markTimeOut(slot, sourceBtn) { 
  if (attendanceRequestInFlight) { 
    setAttendanceNotice('Please wait... your previous attendance request is still processing.', 'loading'); 
    return; 
  } 
  setAttendanceNotice('Please wait... preparing Time Out.', 'loading'); 
  void primeAttendanceAudio(); 
  void playAttendanceSound('timeout'); 
  if (!requirePhoto()) { 
    setAttendanceNotice('Unable to continue Time Out.', 'error'); 
    return; 
  } 
  if (!currentUser || !currentUser.id) { 
    void playAttendanceSound('error'); 
    setAttendanceNotice('Please log in first before Time Out.', 'error'); 
    alert('Please log in first.'); 
    return; 
  } 
 
  attendanceRequestInFlight = true; 
  setAttendanceButtonsLocked(true, sourceBtn || null); 
  setAttendanceNotice('Please wait... recording your Time Out.', 'loading'); 
  const locationPayload = getAttendanceLocationPayload(); 
  const payload = { 
    employeeId: currentUser.id, 
    timeOut: timeNow(), 
    date: isoToday(), 
    useServerTime: true, 
    slot: String(slot || '').trim() || undefined, 
    location: locationPayload.location, 
    latitude: locationPayload.latitude, 
    longitude: locationPayload.longitude, 
    photo: photoData 
  }; 
  try {
    const result = await api('/api/attendance/timeout', { method: 'POST', body: JSON.stringify(payload) });
    clearPhotoSelection();
    setAttendanceNotice('Time out recorded. Updating records...', 'loading');
    loadAttendance()
      .then(() => {
        computeStats();
        filterRecordsByMonth();
      })
      .catch(() => {
        // background refresh failed; keep success notice
      });
    const slotLabel = result.slot === 'PM' ? 'Afternoon' : 'Morning';
    const recordedAt = pickRecordedTime(result, 'timeout');
    const successMessage = `Time out recorded (${slotLabel}${recordedAt ? ` · ${recordedAt}` : ''}).`;
    setAttendanceNotice(successMessage, 'success');
    alert(successMessage);
  } catch (err) { 
    void playAttendanceSound('error'); 
    if (err && err.status === 409) {
      const times = getTodaySlotTimes();
      const recordedAt = slot === 'PM' ? (times.pmOut || '') : (times.amOut || '');
      showAlreadyRecordedNotice('timeout', slot === 'PM' ? 'PM' : 'AM', recordedAt);
    } else {
      const errorMessage = err.message || 'Time out failed.'; 
      setAttendanceNotice(errorMessage, 'error'); 
      alert(errorMessage); 
    }
  } finally {  
    attendanceRequestInFlight = false;  
    setAttendanceButtonsLocked(false);  
  }  
}  

async function startEmployeeSession(user) {
  currentUser = user;
  saveActiveSession(user);
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  empName.textContent = currentUser.name.split(' ')[0];
  empMeta.textContent = `${currentUser.id} · ${currentUser.office}`;
  empAvatar.src = 'assets/logo.jpg';
  empAvatar2.src = 'assets/logo.jpg';
  empName2.textContent = currentUser.name;
  empRole.textContent = `${currentUser.position} · ${currentUser.office}`;

  await loadAttendance();
  computeStats();
  filterRecordsByMonth();
  updateReportContext();
  setAttendanceNotice('');
  clearPhotoSelection();
  initializeLocationState();
  tickClock();
}

function logoutEmployee() {
  currentUser = null;
  attendanceCache = [];
  gpsConsentChoice = 'pending';
  locationRequestInFlight = false;
  pendingPhotoCaptureAfterConsent = false;
  attendanceRequestInFlight = false;
  setAttendanceNotice('');
  setAttendanceButtonsLocked(false);
  clearPhotoSelection();
  resetReportForm();
  loginForm.reset();
  setView('emp-dashboard');
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  clearSavedLogin();
  clearActiveSession();
  closeServerModal();
  closeGpsConsentModal();
  stopGpsWatch();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '').trim();
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee', username, password })
    });
    saveLogin(username, password);
    if (result.user) {
      saveProfile({
        name: result.user.name,
        office: result.user.office,
        employeeType: result.user.employeeType || 'Regular',
        email: result.user.email || username,
        password
      });
    }
    await startEmployeeSession(result.user);
  } catch (err) {
    const message = err.message || 'Invalid credentials. Use email or ID.';
    if (message.toLowerCase().includes('email not verified')) {
      const username = String(payload.username || '').trim();
      const identifierFromServer = err && err.data && err.data.identifier ? String(err.data.identifier).trim() : '';
      const otpIdentifier = identifierFromServer || username;
      if (otpIdentifier) {
        pendingOtpEmail = otpIdentifier;
        openOtpModal();
      }
    }
    alert(message);
  }
});

function openServerModal() {
  serverModal.classList.remove('hidden');
}

function closeServerModal() {
  serverModal.classList.add('hidden');
}

function saveServerSettings() {
  const value = serverUrlInput.value.trim();
  const normalizedServer = normalizeApiUrl(value);
  const websiteValue = websiteUrlInput ? websiteUrlInput.value.trim() : '';
  const normalizedWebsite = normalizeApiUrl(websiteValue);

  if (value && !normalizedServer) {
    alert('Invalid Server URL. Use a valid http/https URL, IP, or domain.');
    return;
  }
  if (websiteValue && !normalizedWebsite) {
    alert('Invalid Website URL. Use a valid http/https URL or domain.');
    return;
  }

  if (value) {
    if (isCapacitor && !isHostedCapacitorRuntime) {
      apiBase = normalizedServer;
      localStorage.setItem('apiBase', apiBase);
      localStorage.setItem('apiBaseOverride', 'true');
    } else {
      apiBase = runtimeOrigin || defaultApiBase || window.location.origin;
      localStorage.setItem('apiBase', apiBase);
      localStorage.setItem('apiBaseOverride', 'false');
    }
  } else {
    apiBase = isCapacitor
      ? (defaultApiBase || 'http://10.0.2.2:5173')
      : (runtimeOrigin || defaultApiBase || window.location.origin);
    localStorage.setItem('apiBase', apiBase);
    localStorage.setItem('apiBaseOverride', 'false');
  }
  serverUrlInput.value = apiBase;

  websiteUrl = normalizedWebsite || buildWebsiteUrl(apiBase);
  localStorage.setItem('websiteUrl', websiteUrl);
  if (websiteUrlInput) websiteUrlInput.value = websiteUrl;

  closeServerModal();
  if (isCapacitor && !isHostedCapacitorRuntime) {
    alert('Server settings saved.');
  } else if (isHostedCapacitorRuntime) {
    alert('Server URL is locked to the official hosted domain for consistent Android updates.');
  } else {
    alert('Web mode uses the current website domain automatically.');
  }
}

async function openWebsiteLink() {
  const websiteValue = websiteUrlInput ? websiteUrlInput.value.trim() : '';
  const normalizedWebsite = normalizeApiUrl(websiteValue || websiteUrl || buildWebsiteUrl(apiBase));
  if (!normalizedWebsite) {
    alert('Please set a valid Website URL first.');
    return;
  }

  websiteUrl = normalizedWebsite;
  localStorage.setItem('websiteUrl', websiteUrl);
  if (websiteUrlInput) websiteUrlInput.value = websiteUrl;

  const capBrowser =
    typeof window !== 'undefined' &&
    window.Capacitor &&
    window.Capacitor.Plugins &&
    window.Capacitor.Plugins.Browser &&
    typeof window.Capacitor.Plugins.Browser.open === 'function'
      ? window.Capacitor.Plugins.Browser
      : null;

  if (capBrowser) {
    try {
      await capBrowser.open({ url: websiteUrl });
      return;
    } catch (err) {
      // fallback to browser open below
    }
  }

  const opened = window.open(websiteUrl, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = websiteUrl;
}

function openRegisterModal() {
  registerModal.classList.remove('hidden');
}

function closeRegisterModal() {
  registerModal.classList.add('hidden');
  registerForm.reset();
}

function notifyOtpDelivery(result, options = {}) {
  const successMessage = options.successMessage || 'OTP sent to your email.';
  const contextPrefix = options.contextPrefix || '';
  const emailSent = !!(result && result.emailSent);
  const emailError = result && result.emailError ? String(result.emailError).trim() : '';
  const prefixText = contextPrefix ? `${contextPrefix} ` : '';

  if (!emailSent || emailError) {
    alert(`${prefixText}OTP was generated, but email delivery is unavailable right now. Please tap Resend OTP or contact your admin.`);
    return;
  }

  alert(successMessage);
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const result = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    saveProfile(payload);
    const loginUser = loginForm.querySelector('input[name="username"]');
    const loginPass = loginForm.querySelector('input[name="password"]');
    if (loginUser) loginUser.value = payload.email || result.employee.email || result.employee.id;
    if (loginPass) loginPass.value = payload.password;
    pendingOtpEmail = result.employee.email || result.employee.username || result.employee.id || payload.email;
    closeRegisterModal();
    openOtpModal();
    notifyOtpDelivery(result, {
      successMessage: 'OTP sent to your email. Please enter the code to verify.',
      contextPrefix: 'Registration successful.'
    });
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Registration failed.');
    }
  }
}

function openForgotModal() {
  forgotModal.classList.remove('hidden');
}

function closeForgotModal() {
  forgotModal.classList.add('hidden');
  forgotForm.reset();
}

async function handleForgot(event) {
  event.preventDefault();
  const formData = new FormData(forgotForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/password-reset', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee', username: payload.username, newPassword: payload.newPassword })
    });
    alert('Password updated. You can log in now.');
    closeForgotModal();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Reset failed.');
    }
  }
}

function openOtpModal() {
  if (!otpModal) return;
  otpModal.classList.remove('hidden');
}

function closeOtpModal() {
  if (!otpModal) return;
  otpModal.classList.add('hidden');
  if (otpForm) otpForm.reset();
}

async function handleOtpVerify(event) {
  event.preventDefault();
  if (!pendingOtpEmail) {
    alert('Missing account identifier for verification. Please register again.');
    return;
  }
  const formData = new FormData(otpForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/register/verify', {
      method: 'POST',
      body: JSON.stringify({ identifier: pendingOtpEmail, otp: payload.otp })
    });
    alert('Email verified. You can now log in.');
    closeOtpModal();
  } catch (err) {
    alert(err.message || 'OTP verification failed.');
  }
}

async function handleOtpResend() {
  if (!pendingOtpEmail) {
    alert('Missing account identifier for verification. Please register again.');
    return;
  }
  try {
    const result = await api('/api/register/resend', {
      method: 'POST',
      body: JSON.stringify({ identifier: pendingOtpEmail })
    });
    notifyOtpDelivery(result, {
      successMessage: 'OTP resent. Please check your email.',
      contextPrefix: 'OTP resent.'
    });
  } catch (err) {
    alert(err.message || 'Unable to resend OTP.');
  }
}

function openConcernModal() {
  concernModal.classList.remove('hidden');
  setInlineNotice(concernNotice, '');
}

function closeConcernModal() {
  concernModal.classList.add('hidden');
  concernForm.reset();
  setInlineNotice(concernNotice, '');
}

async function handleConcern(event) {
  event.preventDefault();
  if (!currentUser) {
    alert('Please log in first.');
    return;
  }
  const formData = new FormData(concernForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    setInlineNotice(concernNotice, 'Please hold on, your concern is being submitted.', 'loading');
    if (concernSubmitBtn) {
      concernSubmitBtn.disabled = true;
      concernSubmitBtn.dataset.originalText = concernSubmitBtn.textContent;
      concernSubmitBtn.textContent = 'Sending...';
    }
    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        office: currentUser.office,
        subject: payload.subject,
        message: payload.message
      })
    });
    alert('Concern sent to admin.');
    setInlineNotice(concernNotice, 'Concern submitted.', 'success');
    closeConcernModal();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Unable to send concern.');
    }
    setInlineNotice(concernNotice, 'Unable to send concern.', 'error');
  } finally {
    if (concernSubmitBtn) {
      concernSubmitBtn.disabled = false;
      concernSubmitBtn.textContent = concernSubmitBtn.dataset.originalText || 'Send';
      delete concernSubmitBtn.dataset.originalText;
    }
  }
}

function resetReportForm() {
  if (reportForm) reportForm.reset();
}

async function handleDailyReport(event) {
  event.preventDefault();
  if (!currentUser) {
    alert('Please log in first.');
    return;
  }
  const formData = new FormData(reportForm);
  const summary = String(formData.get('summary') || '').trim();
  if (!summary) {
    alert('Please write your daily report first.');
    return;
  }
  const record = getTodayAttendance();
  const timeLogs = record
    ? {
        timeInAM: record.timeInAM || record.timeIn || '',
        timeOutAM: record.timeOutAM || '',
        timeInPM: record.timeInPM || '',
        timeOutPM: record.timeOutPM || record.timeOut || ''
      }
    : {
        timeInAM: '',
        timeOutAM: '',
        timeInPM: '',
        timeOutPM: ''
      };
  try {
    setInlineNotice(reportNotice, 'Please wait, your report is being submitted.', 'loading');
    if (reportSubmitBtn) {
      reportSubmitBtn.disabled = true;
      reportSubmitBtn.dataset.originalText = reportSubmitBtn.textContent;
      reportSubmitBtn.textContent = 'Submitting...';
    }
    const result = await api('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        office: currentUser.office,
        reportDate: isoToday(),
        summary,
        timeLogs
      })
    });
    if (result && result.report) {
      alert('Report submitted to admin.');
      setInlineNotice(reportNotice, 'Report submitted.', 'success');
    } else {
      alert('Report submitted.');
      setInlineNotice(reportNotice, 'Report submitted.', 'success');
    }
    resetReportForm();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Unable to submit report.');
    }
    setInlineNotice(reportNotice, 'Unable to submit report.', 'error');
  } finally {
    if (reportSubmitBtn) {
      reportSubmitBtn.disabled = false;
      reportSubmitBtn.textContent = reportSubmitBtn.dataset.originalText || 'Submit Report';
      delete reportSubmitBtn.dataset.originalText;
    }
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

recordsMonth.addEventListener('change', filterRecordsByMonth);

if (refreshLocationBtn) refreshLocationBtn.addEventListener('click', openGpsConsentModal);
if (gpsRefreshBtn) gpsRefreshBtn.addEventListener('click', openGpsConsentModal);
if (openMapCurrentBtn) {
  openMapCurrentBtn.addEventListener('click', () => {
    openMapByCoordinates(locationLat.textContent, locationLng.textContent, locationName.textContent);
  });
}
if (closeGpsConsentBtn) closeGpsConsentBtn.addEventListener('click', closeGpsConsentModal);
if (denyGpsConsentBtn) denyGpsConsentBtn.addEventListener('click', handleGpsConsentDeny);
if (allowGpsConsentBtn) allowGpsConsentBtn.addEventListener('click', handleGpsConsentAllow);
if (gpsConsentModal) {
  gpsConsentModal.addEventListener('click', (event) => {
    if (event.target === gpsConsentModal) closeGpsConsentModal();
  });
}

function bindAttendanceAudioWarmup(button) {
  if (!button) return;
  const warm = () => {
    primeAttendanceAudio();
  };
  button.addEventListener('pointerdown', warm, { passive: true });
  button.addEventListener('touchstart', warm, { passive: true });
  button.addEventListener('mousedown', warm, { passive: true });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') warm();
  });
}

bindAttendanceAudioWarmup(timeInAmBtn); 
bindAttendanceAudioWarmup(timeOutAmBtn); 
bindAttendanceAudioWarmup(timeInPmBtn); 
bindAttendanceAudioWarmup(timeOutPmBtn); 
 
if (timeInAmBtn) timeInAmBtn.addEventListener('click', () => handleTimeInClick('AM', timeInAmBtn)); 
if (timeOutAmBtn) timeOutAmBtn.addEventListener('click', () => handleTimeOutClick('AM', timeOutAmBtn)); 
if (timeInPmBtn) timeInPmBtn.addEventListener('click', () => handleTimeInClick('PM', timeInPmBtn)); 
if (timeOutPmBtn) timeOutPmBtn.addEventListener('click', () => handleTimeOutClick('PM', timeOutPmBtn)); 

if (takePhotoBtn) {
  takePhotoBtn.addEventListener('click', (event) => {
    event.preventDefault();
    openPhotoCapture();
  });
}

if (photoInput) {
  photoInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoData = e.target.result;
      if (photoPreview) photoPreview.src = photoData;
    };
    reader.readAsDataURL(file);
  });
}

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

openServerBtn.addEventListener('click', openServerModal);
closeServerBtn.addEventListener('click', closeServerModal);
cancelServerBtn.addEventListener('click', closeServerModal);
saveServerBtn.addEventListener('click', saveServerSettings);
if (openWebsiteLinkBtn) openWebsiteLinkBtn.addEventListener('click', openWebsiteLink);
if (logoutBtn) logoutBtn.addEventListener('click', logoutEmployee);

openRegisterBtn.addEventListener('click', openRegisterModal);
closeRegisterBtn.addEventListener('click', closeRegisterModal);
cancelRegisterBtn.addEventListener('click', closeRegisterModal);
registerForm.addEventListener('submit', handleRegister);

openForgotBtn.addEventListener('click', openForgotModal);
closeForgotBtn.addEventListener('click', closeForgotModal);
cancelForgotBtn.addEventListener('click', closeForgotModal);
forgotForm.addEventListener('submit', handleForgot);

if (closeOtpBtn) closeOtpBtn.addEventListener('click', closeOtpModal);
if (resendOtpBtn) resendOtpBtn.addEventListener('click', handleOtpResend);
if (otpForm) otpForm.addEventListener('submit', handleOtpVerify);

if (openConcernBtn) openConcernBtn.addEventListener('click', openConcernModal);
if (closeConcernBtn) closeConcernBtn.addEventListener('click', closeConcernModal);
if (cancelConcernBtn) cancelConcernBtn.addEventListener('click', closeConcernModal);
if (concernForm) concernForm.addEventListener('submit', handleConcern);
if (reportForm) reportForm.addEventListener('submit', handleDailyReport);

if (statCards && statCards.length) {
  statCards.forEach((card) => {
    const open = () => openStatModal(card.dataset.stat);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

if (closeStatModalBtn) closeStatModalBtn.addEventListener('click', closeStatModal);
if (statModal) {
  statModal.addEventListener('click', (event) => {
    if (event.target === statModal) closeStatModal();
  });
}

setInterval(tickClock, 1000);

if (!recordsMonth.value) {
  const now = new Date();
  recordsMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

tickClock();
clearLegacyEmployeeCache();

async function attemptAutoLogin() {
  if (autoRestoreAttempted) return;
  autoRestoreAttempted = true;

  const activeSessionUser = loadActiveSession();
  if (activeSessionUser) {
    setLoginStatus('Signing you in automatically...');
    try {
      await startEmployeeSession(activeSessionUser);
      setLoginStatus('');
      return;
    } catch (err) {
      setLoginStatus('');
      clearActiveSession();
    }
  }

  const savedLogin = localStorage.getItem('lastLogin');
  if (!savedLogin) return;
  let creds = null;
  try {
    creds = JSON.parse(savedLogin);
  } catch (err) {
    return;
  }
  if (!creds || !creds.username || !creds.password) return;
  setLoginStatus('Signing you in automatically...');
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee', username: creds.username, password: creds.password })
    });
    await startEmployeeSession(result.user);
    setLoginStatus('');
  } catch (err) {
    setLoginStatus('');
    const profile = loadProfile();
    if (profile && (profile.email || profile.username)) {
      try {
        const restore = await api('/api/register', {
          method: 'POST',
          body: JSON.stringify(profile)
        });
        pendingOtpEmail = profile.email || profile.username || '';
        openOtpModal();
        notifyOtpDelivery(restore, {
          successMessage: 'Account restored. OTP sent to your email.',
          contextPrefix: 'Account restored.'
        });
      } catch (restoreErr) {
        // ignore restore errors
      }
    }
  }
}

attemptAutoLogin();
