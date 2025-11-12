(() => {
  const $ = id => document.getElementById(id);

  // ==========================
  // Dynamic backend resolver
  // ==========================
  function detectServerBase() {
    const stored = localStorage.getItem('ap_server');
    if (stored && stored.trim() !== '') {
      console.log('🌐 Using custom server from localStorage:', stored);
      return stored.replace(/\/$/, '');
    }

    const host = window.location.hostname;
    if (host.includes('github.io')) {
      // GitHub Pages → use LAN backend
      return 'http://172.16.5.22:3000';
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      // Local development → local backend
      return 'http://localhost:3000';
    }
    return 'http://172.16.5.22:3000';
  }

  // ==========================
  // Initial config
  // ==========================
  let SERVER_BASE = detectServerBase().replace(/\/$/, '');
  let ADMIN_TOKEN = localStorage.getItem('ap_token') || 'secret123';

  $('serverBase').value = SERVER_BASE;
  $('adminToken').value = ADMIN_TOKEN;

  // Quick reachability test
  (async () => {
    try {
      const res = await fetch(SERVER_BASE + '/api/health');
      if (res.ok) {
        console.log('✅ Backend reachable at', SERVER_BASE);
      } else {
        console.warn('⚠️ Backend responded with', res.status);
      }
    } catch (e) {
      console.error('❌ Backend not reachable:', SERVER_BASE);
    }
  })();

  // ==========================
  // Helpers
  // ==========================
  function headers() {
    return { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN };
  }

  function setStatusCount(n) { $('userCount').textContent = String(n); }

  async function apiFetch(endpoint, opts = {}) {
    const url = SERVER_BASE + endpoint;
    const res = await fetch(url, Object.assign({ headers: headers() }, opts));
    if (!res.ok) {
      const txt = await res.text();
      let parsed;
      try { parsed = JSON.parse(txt); } catch (e) { parsed = { error: txt || res.statusText }; }
      throw parsed;
    }
    return res.json();
  }

  // ==========================
  // Render user table
  // ==========================
  function renderUsers(users) {
    const tbody = $('usersTbody');
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">No users found</td></tr>';
      setStatusCount(0);
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.enrollment_number}</strong></td>
        <td>${u.username || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${u.active_session_id ? `<span class="status">${u.active_session_id}</span>` : '<span class="muted">Inactive</span>'}</td>
        <td class="actions">
          <button data-id="${u.enrollment_number}" class="viewBtn secondary">View</button>
          <button data-id="${u.enrollment_number}" class="delBtn danger">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    setStatusCount(users.length);
  }

  // ==========================
  // Fetch + actions
  // ==========================
  async function loadAllUsers() {
    try {
      const data = await apiFetch('/admin/users');
      renderUsers(data.users || []);
    } catch (err) {
      alert('Failed to fetch users: ' + (err?.error || JSON.stringify(err)));
    }
  }

  async function viewUser(enrollment_number) {
    try {
      const data = await apiFetch(`/admin/user/${encodeURIComponent(enrollment_number)}`);
      $('detailCard').style.display = 'block';
      $('detailTitle').textContent = `User: ${enrollment_number}`;
      $('detailId').textContent = `Requested at ${new Date().toLocaleString()}`;
      $('userRaw').textContent = JSON.stringify(data.user[0] || {}, null, 2);

      const logs = data.logs || [];
      $('userLogs').textContent =
        logs.length > 0
          ? logs.map(l => `${l.created_at || `${l.event_date} ${l.event_time}`} — ${l.event_message}`).join('\n\n')
          : 'No logs found.';
    } catch (err) {
      alert('Failed to fetch user: ' + (err?.error || JSON.stringify(err)));
    }
  }

  async function deleteUser(enrollment_number) {
    if (!confirm(`Delete user ${enrollment_number}? This action cannot be undone.`)) return;
    try {
      await apiFetch(`/admin/user/${encodeURIComponent(enrollment_number)}`, { method: 'DELETE' });
      alert('Deleted successfully');
      $('detailCard').style.display = 'none';
      loadAllUsers();
    } catch (err) {
      alert('Delete failed: ' + (err?.error || JSON.stringify(err)));
    }
  }

  // ==========================
  // Event bindings
  // ==========================
  $('usersTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('viewBtn')) return viewUser(id);
    if (btn.classList.contains('delBtn')) return deleteUser(id);
  });

  $('btnSearch').addEventListener('click', async () => {
    const q = $('searchInput').value.trim();
    if (!q) { alert('Enter enrollment number'); return; }
    viewUser(q);
  });

  $('btnListAll').addEventListener('click', loadAllUsers);
  $('btnFetchAll').addEventListener('click', loadAllUsers);

  $('btnReload').addEventListener('click', () => {
    SERVER_BASE = $('serverBase').value.replace(/\/$/, '') || SERVER_BASE;
    ADMIN_TOKEN = $('adminToken').value || ADMIN_TOKEN;
    localStorage.setItem('ap_server', SERVER_BASE);
    localStorage.setItem('ap_token', ADMIN_TOKEN);
    alert('Config saved!');
  });

  $('btnDeleteUser').addEventListener('click', () => {
    const userId = $('detailTitle').textContent.replace(/^User:\s*/, '').trim();
    if (userId) deleteUser(userId);
  });

  $('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnSearch').click();
  });

  // ==========================
  // Initial load
  // ==========================
  loadAllUsers();
})();
