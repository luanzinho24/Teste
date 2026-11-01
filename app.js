const STORAGE_KEY = 'lua_dashboard_config_v1';
const SESSION_KEY = 'lua_dashboard_session_v1';
const DEFAULT_CLIENT_ID = 'default-client';

const defaultConfig = {
  clientId: DEFAULT_CLIENT_ID,
  config: {
    autoSave: true
  },
  esp: {
    enabled: false,
    color: '#4f8cff',
    distance: 180,
    visibility: 'Visible only',
    authorizedEntities: ['Players'],
    boxes: true,
    names: true,
    health: true,
    distanceLabel: true
  },
  aimbot: {
    enabled: false,
    mode: 'Assist',
    range: 80,
    smoothness: 35,
    head: true,
    body: false,
    weapon: false
  },
  silentAim: {
    enabled: false,
    mode: 'Passive',
    delay: 120,
    pitch: 40,
    prediction: true,
    trigger: false,
    hold: false
  },
  fov: {
    value: 90
  },
  visual: {
    enemyColor: '#ff5a5a',
    allyColor: '#4f8cff',
    transparency: 72,
    labels: true,
    shadows: false,
    outline: true,
    trails: false
  },
  lua: {
    connected: false,
    status: 'Offline',
    syncInterval: 30
  },
  lastSavedAt: null,
  lastHeartbeatAt: null,
  lastError: null
};

const state = {
  config: loadConfig(),
  activeTab: 'ESP',
  apiStatus: 'Conectando',
  lastHeartbeatText: '--',
  lastSavedText: '--'
};

function deepMerge(target, source) {
  const output = Array.isArray(target) ? [...target] : { ...target };

  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && value !== null && typeof output[key] === 'object' && !Array.isArray(output[key])) {
      output[key] = deepMerge(output[key], value);
      return;
    }

    output[key] = value;
  });

  return output;
}

function getStorageKeyForClient() {
  const clientId = (state.config && state.config.clientId) || DEFAULT_CLIENT_ID;
  return `${STORAGE_KEY}:${String(clientId).trim() || DEFAULT_CLIENT_ID}`;
}

function ensureSessionRecord() {
  const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  const nextSession = {
    ...existing,
    clientId: state.config.clientId,
    updatedAt: new Date().toISOString()
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  return nextSession;
}

function loadConfig() {
  const savedRaw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(`${STORAGE_KEY}:${DEFAULT_CLIENT_ID}`);

  if (!savedRaw) {
    return deepMerge(defaultConfig, {});
  }

  try {
    const parsed = JSON.parse(savedRaw);
    return deepMerge(defaultConfig, parsed);
  } catch (error) {
    return deepMerge(defaultConfig, {});
  }
}

function saveConfig() {
  const payload = JSON.parse(JSON.stringify(state.config));
  payload.lastSavedAt = new Date().toISOString();
  state.config.lastSavedAt = payload.lastSavedAt;
  localStorage.setItem(getStorageKeyForClient(), JSON.stringify(payload));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  ensureSessionRecord();
  updateStatusLabels();
}

function restoreDefaultConfig() {
  state.config = deepMerge(defaultConfig, {});
  saveConfig();
  syncControlsFromState();
}

function loadSavedConfig() {
  const key = getStorageKeyForClient();
  const raw = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    state.config = deepMerge(defaultConfig, {});
    updateStatusLabels();
    syncControlsFromState();
    return;
  }

  try {
    state.config = deepMerge(defaultConfig, JSON.parse(raw));
    ensureSessionRecord();
    syncControlsFromState();
    updateStatusLabels();
  } catch (error) {
    state.config = deepMerge(defaultConfig, {});
    updateStatusLabels();
    syncControlsFromState();
  }
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((acc, segment) => {
    if (!acc[segment] || typeof acc[segment] !== 'object') {
      acc[segment] = {};
    }
    return acc[segment];
  }, obj);

  target[lastKey] = value;
}

function updateStatusLabels() {
  const statusValue = state.apiStatus || 'Offline';
  const heartbeatText = state.lastHeartbeatText || '--';

  document.getElementById('heartbeatStatus').textContent = statusValue;
  document.getElementById('lastPing').textContent = heartbeatText;
  document.getElementById('sessionState').textContent = statusValue === 'Offline' ? 'Sessão expirada' : 'Sessão ativa';
  document.getElementById('syncIntervalValue').textContent = `${state.config.lua.syncInterval}s`;
  document.getElementById('luaHeartbeatLabel').textContent = heartbeatText;
  document.getElementById('lastSavedLabel').textContent = state.config.lastSavedAt ? new Date(state.config.lastSavedAt).toLocaleString('pt-BR') : '--';
  document.getElementById('onlineClients').textContent = '0';
}

function syncControlsFromState() {
  const controls = document.querySelectorAll('[data-setting]');

  controls.forEach((control) => {
    const value = getByPath(state.config, control.dataset.setting);
    if (control.type === 'checkbox') {
      control.checked = Boolean(value);
      return;
    }

    if (control.type === 'color' || control.type === 'number' || control.type === 'range' || control.tagName === 'SELECT') {
      control.value = value;
    }
  });

  document.querySelectorAll('[data-array]').forEach((control) => {
    const values = getByPath(state.config, control.dataset.array) || [];
    control.checked = Array.isArray(values) ? values.includes(control.value) : false;
  });

  const fovInput = document.getElementById('cameraFovValue');
  const fovSlider = document.getElementById('cameraFovSlider');
  if (fovInput && fovSlider) {
    const currentFov = state.config.fov.value;
    fovInput.value = currentFov;
    fovSlider.value = currentFov;
  }

  updateStatusLabels();
}

function handleControlInput(event) {
  const { setting, array } = event.target.dataset;

  if (setting) {
    const nextValue = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setByPath(state.config, setting, nextValue);
  }

  if (array) {
    const list = getByPath(state.config, array) || [];
    const value = event.target.value;
    const updated = event.target.checked
      ? Array.from(new Set([...list, value]))
      : list.filter((item) => item !== value);

    setByPath(state.config, array, updated);
  }

  if (state.config.config.autoSave) {
    saveConfig();
  }

  if (event.target.dataset.setting === 'fov.value') {
    const nextFov = Number(event.target.value);
    state.config.fov.value = nextFov;
    document.getElementById('cameraFovValue').value = nextFov;
    document.getElementById('cameraFovSlider').value = nextFov;
  }

  updateStatusLabels();
}

function setupTabNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      state.activeTab = tabName;
      document.getElementById('currentTabTitle').textContent = tabName;

      navButtons.forEach((item) => item.classList.toggle('active', item === button));
      panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tabName));
    });
  });
}

function configureBindings() {
  document.querySelectorAll('[data-setting]').forEach((control) => {
    control.addEventListener('input', handleControlInput);
    control.addEventListener('change', handleControlInput);
  });

  document.querySelectorAll('[data-array]').forEach((control) => {
    control.addEventListener('change', handleControlInput);
  });

  document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
    saveConfig();
    state.lastSavedText = 'Salvo';
    updateStatusLabels();
  });

  document.getElementById('loadConfigBtn')?.addEventListener('click', () => {
    loadSavedConfig();
  });

  document.getElementById('restoreConfigBtn')?.addEventListener('click', () => {
    restoreDefaultConfig();
  });
}

function setConnectionState(stateValue) {
  state.apiStatus = stateValue;
  updateStatusLabels();
}

async function fetchJsonWithFallback(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    },
    ...(options.body !== undefined ? { body: options.body } : {})
  });

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      payload = responseText;
    }
  }

  return { response, payload };
}

async function fetchLuaConfig() {
  const clientId = encodeURIComponent(String(state.config.clientId || DEFAULT_CLIENT_ID));
  const url = `/v1/lua/config?clientId=${clientId}`;

  try {
    setConnectionState('Conectando');
    const { response, payload } = await fetchJsonWithFallback(url, { method: 'GET' });

    if (!response.ok) {
      state.lastError = `Config erro: ${response.status}`;
      setConnectionState('Erro');
      return;
    }

    if (payload !== null) {
      state.config = deepMerge(state.config, payload);
    }

    state.apiStatus = 'Online';
    setConnectionState('Online');
  } catch (error) {
    state.lastError = error && error.message ? error.message : 'Erro ao carregar configuração';
    setConnectionState('Erro');
  }
}

async function sendLuaHeartbeat() {
  const clientId = encodeURIComponent(String(state.config.clientId || DEFAULT_CLIENT_ID));
  const url = `/v1/lua/heartbeat?clientId=${clientId}`;

  try {
    const { response, payload } = await fetchJsonWithFallback(url, { method: 'POST' });

    if (!response.ok) {
      state.lastError = `Heartbeat erro: ${response.status}`;
      setConnectionState('Erro');
      return;
    }

    const now = new Date();
    state.lastHeartbeatText = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    state.config.lastHeartbeatAt = now.toISOString();
    state.apiStatus = 'Online';
    setConnectionState('Online');

    if (payload !== null) {
      state.config.lastHeartbeatPayload = payload;
    }
  } catch (error) {
    state.lastError = error && error.message ? error.message : 'Erro ao enviar heartbeat';
    setConnectionState('Erro');
  }
}

async function fetchLuaStatus() {
  const clientId = encodeURIComponent(String(state.config.clientId || DEFAULT_CLIENT_ID));
  const url = `/v1/lua/status?clientId=${clientId}`;

  try {
    const { response } = await fetchJsonWithFallback(url, { method: 'GET' });

    if (!response.ok) {
      state.apiStatus = 'Offline';
      setConnectionState('Offline');
      return;
    }

    state.apiStatus = 'Online';
    setConnectionState('Online');
  } catch (error) {
    state.lastError = error && error.message ? error.message : 'Erro ao consultar status';
    setConnectionState('Erro');
  }
}

function scheduleLuaSync() {
  const intervalMs = Math.max(5000, Number(state.config.lua.syncInterval || 30) * 1000);

  setInterval(() => {
    if (state.config.lua.connected) {
      sendLuaHeartbeat();
    }

    fetchLuaStatus();
  }, intervalMs);
}

function initializeDashboard() {
  ensureSessionRecord();
  state.config = loadConfig();
  setupTabNavigation();
  configureBindings();
  syncControlsFromState();
  setConnectionState('Conectando');

  const connectionCheckbox = document.querySelector('[data-setting="lua.connected"]');
  if (connectionCheckbox) {
    connectionCheckbox.addEventListener('change', () => {
      state.config.lua.connected = connectionCheckbox.checked;
      if (connectionCheckbox.checked) {
        fetchLuaConfig();
        sendLuaHeartbeat();
        setConnectionState('Conectando');
      } else {
        setConnectionState('Offline');
      }
      if (state.config.config.autoSave) {
        saveConfig();
      }
    });
  }

  if (state.config.lua.connected) {
    fetchLuaConfig();
    sendLuaHeartbeat();
  }

  scheduleLuaSync();
}

initializeDashboard();
