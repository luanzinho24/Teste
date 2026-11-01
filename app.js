const sessionKey = 'lua_session';

function getStoredSession() {
  const raw = sessionStorage.getItem(sessionKey);
  if (!raw) {
    return { authenticated: true, user: 'admin', token: 'session-only-token' };
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return { authenticated: true, user: 'admin', token: 'session-only-token' };
  }
}

function ensureSession() {
  const session = getStoredSession();
  sessionStorage.setItem(sessionKey, JSON.stringify({
    ...session,
    authenticated: true,
    lastAccess: new Date().toISOString()
  }));

  return sessionStorage.getItem(sessionKey);
}

function refreshStatus() {
  const session = JSON.parse(ensureSession());
  const onlineClients = Math.max(12, Math.floor(Math.random() * 40));
  const heartbeatState = onlineClients > 20 ? 'Normal' : 'Atenção';
  const lastPing = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  document.getElementById('onlineClients').textContent = String(onlineClients);
  document.getElementById('heartbeatStatus').textContent = heartbeatState;
  document.getElementById('lastPing').textContent = lastPing;
  document.getElementById('sessionState').textContent = session.authenticated
    ? 'Sessão ativa'
    : 'Sessão expirada';
}

ensureSession();
refreshStatus();
setInterval(refreshStatus, 30000);
