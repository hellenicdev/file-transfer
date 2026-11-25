let uploaderId = null;
let roomId = null;
let socket = null;
let connectedUsers = 0;

function generateId() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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

function renderFiles(files) {
  const container = document.getElementById('fileListContainer');
  const countEl = document.getElementById('filesCount');

  if (!files || files.length === 0) {
    container.innerHTML = `
      <div class="empty-state" id="emptyState">
        <div class="empty-state-icon">&#128196;</div>
        <p class="empty-state-text">No files yet. Upload something!</p>
      </div>
    `;
    countEl.textContent = '0 files';
    return;
  }

  countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;

  const list = document.createElement('div');
  list.className = 'file-list';

  files.forEach((file) => {
    const isOwn = file.uploaderId === uploaderId;
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-icon">&#128206;</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(file.originalName)}">${escapeHtml(file.originalName)}</div>
        <div class="file-meta">
          <span>${formatSize(file.size)}</span>
          <span>${formatDate(file.uploadedAt)}</span>
          <span>${isOwn ? 'You' : 'Roommate'}</span>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn btn-secondary download-btn" data-fileid="${file._id}">Download</button>
        ${isOwn ? `<button class="btn btn-danger delete-btn" data-fileid="${file._id}">Delete</button>` : ''}
      </div>
    `;
    list.appendChild(item);
  });

  container.innerHTML = '';
  container.appendChild(list);

  container.querySelectorAll('.download-btn').forEach((btn) => {
    btn.addEventListener('click', () => downloadFile(btn.dataset.fileid));
  });

  container.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteFile(btn.dataset.fileid));
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchFiles() {
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}/files`);
    const data = await response.json();
    if (data.files) {
      renderFiles(data.files);
    }
  } catch (err) {
    console.error('Fetch files error:', err);
  }
}

async function downloadFile(fileId) {
  try {
    const response = await fetch(`${API_URL}/api/files/${fileId}/download`);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (disposition) {
      const match = disposition.match(/filename="?(.+?)"?$/);
      if (match) filename = match[1];
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast('Download failed: ' + err.message, 'error');
  }
}

async function deleteFile(fileId) {
  if (!confirm('Delete this file?')) return;

  try {
    const response = await fetch(`${API_URL}/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploaderId }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Delete failed');
    }
    showToast('File deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function uploadFiles(files) {
  const container = document.getElementById('progressContainer');

  Array.from(files).forEach((file) => {
    const progressItem = document.createElement('div');
    progressItem.className = 'progress-item';
    progressItem.innerHTML = `
      <div class="progress-header">
        <span class="progress-filename">${escapeHtml(file.name)}</span>
        <span class="progress-percent" id="progress-${file.name}">0%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" id="progress-fill-${file.name}"></div>
      </div>
    `;
    container.appendChild(progressItem);
  });

  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('files', file));
  formData.append('uploaderId', uploaderId);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_URL}/api/files/upload/${roomId}`);

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      Array.from(files).forEach((file) => {
        const percentEl = document.getElementById(`progress-${file.name}`);
        const fillEl = document.getElementById(`progress-fill-${file.name}`);
        if (percentEl && fillEl) {
          if (files.length === 1) {
            percentEl.textContent = percent + '%';
            fillEl.style.width = percent + '%';
          }
        }
      });

      if (files.length > 1) {
        const avgPercent = Math.round(
          (Array.from(files).reduce((sum, f) => {
            const el = document.getElementById(`progress-fill-${f.name}`);
            return sum + (el ? parseInt(el.style.width) : 0);
          }, 0) +
            percent * files.length) /
            (files.length * 2)
        );
        Array.from(files).forEach((file) => {
          const percentEl = document.getElementById(`progress-${file.name}`);
          const fillEl = document.getElementById(`progress-fill-${file.name}`);
          if (percentEl && fillEl) {
            percentEl.textContent = avgPercent + '%';
            fillEl.style.width = avgPercent + '%';
          }
        });
      }
    }
  });

  xhr.onload = () => {
    container.innerHTML = '';
    if (xhr.status === 201) {
      fetchFiles();
      showToast('Upload complete!', 'success');
    } else {
      try {
        const err = JSON.parse(xhr.responseText);
        showToast(err.error || 'Upload failed', 'error');
      } catch {
        showToast('Upload failed', 'error');
      }
    }
  };

  xhr.onerror = () => {
    container.innerHTML = '';
    showToast('Upload failed - network error', 'error');
  };

  xhr.send(formData);
}

function initSocket() {
  socket = io(SOCKET_URL);

  socket.on('connect', () => {
    socket.emit('join-room', { roomId, uploaderId });
  });

  socket.on('room-users', (data) => {
    connectedUsers = data.count;
    document.getElementById('usersCount').textContent = data.count;
    const dot = document.getElementById('statusDot');
    dot.className = data.count > 0 ? 'dot online' : 'dot offline';
  });

  socket.on('file-uploaded', (data) => {
    if (data.files) {
      fetchFiles();
      showToast('New file uploaded', 'info');
    }
  });

  socket.on('file-deleted', () => {
    fetchFiles();
    showToast('A file was deleted', 'info');
  });

  socket.on('user-joined', () => {
    showToast('Someone joined the room', 'info');
  });

  socket.on('user-left', () => {
    showToast('Someone left the room', 'info');
  });

  socket.on('disconnect', () => {
    showToast('Disconnected from server. Reconnecting...', 'error');
  });

  socket.on('reconnect', () => {
    showToast('Reconnected!', 'success');
    socket.emit('join-room', { roomId, uploaderId });
    fetchFiles();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get('roomId');

  if (!roomId) {
    window.location.href = 'index.html';
    return;
  }

  let storedId = sessionStorage.getItem('uploaderId');
  if (!storedId) {
    storedId = generateId();
    sessionStorage.setItem('uploaderId', storedId);
  }
  uploaderId = storedId;

  document.getElementById('roomCodeDisplay').textContent = roomId;

  fetchFiles();
  initSocket();

  document.getElementById('copyRoomBtn').addEventListener('click', () => {
    const link = `${window.location.origin}${window.location.pathname}?roomId=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Room link copied!', 'success');
    }).catch(() => {
      showToast('Failed to copy link', 'error');
    });
  });

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFiles(fileInput.files);
      fileInput.value = '';
    }
  });
});
