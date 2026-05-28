function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function apiRequest(endpoint, body) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

let createToken = null;
let joinToken = null;
let turnstileReady = false;

function renderWidgets() {
  if (typeof turnstile === 'undefined' || !turnstileReady) {
    setTimeout(renderWidgets, 200);
    return;
  }
  turnstile.render('#createTurnstile', {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token) => { createToken = token; },
    'expired-callback': () => { createToken = null; },
  });
  turnstile.render('#joinTurnstile', {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token) => { joinToken = token; },
    'expired-callback': () => { joinToken = null; },
  });
}

function loadTurnstile() {
  if (typeof turnstile !== 'undefined') {
    turnstile.ready(() => {
      turnstileReady = true;
      renderWidgets();
    });
  } else {
    setTimeout(loadTurnstile, 200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTurnstile();

  document.getElementById('createRoomBtn').addEventListener('click', async () => {
    if (!createToken) {
      showToast('Please complete the CAPTCHA first', 'error');
      return;
    }
    const btn = document.getElementById('createRoomBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const data = await apiRequest('/api/rooms/create', {
        turnstileToken: createToken,
      });
      window.location.href = `room.html?roomId=${data.roomId}`;
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Room';
    }
  });

  document.getElementById('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!joinToken) {
      showToast('Please complete the CAPTCHA first', 'error');
      return;
    }

    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!roomCode || roomCode.length !== 6) {
      showToast('Please enter a valid 6-character room code', 'error');
      return;
    }

    const btn = document.getElementById('joinRoomBtn');
    btn.disabled = true;
    btn.textContent = 'Joining...';

    try {
      const data = await apiRequest('/api/rooms/join', {
        roomId: roomCode,
        turnstileToken: joinToken,
      });
      window.location.href = `room.html?roomId=${data.roomId}`;
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Join Room';
    }
  });
});
