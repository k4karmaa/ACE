(() => {
  const $ = id => document.getElementById(id);

  // initial config
  let SERVER_BASE = (localStorage.getItem('ap_server') || 'http://172.16.5.22:3000').replace(/\/$/, '');
  let ADMIN_TOKEN = localStorage.getItem('ap_token') || 'secret123';

  $('serverBase').value = SERVER_BASE;
  $('adminToken').value = ADMIN_TOKEN;

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

  // Render all users in table
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

  // Load all users from backend
  async function loadAllUsers() {
    try {
      const data = await apiFetch('/admin/users');
      renderUsers(data.users || []);
    } catch (err) {
      alert('Failed to fetch users: ' + (err?.error || JSON.stringify(err)));
    }
  }

  // View a specific user's logs and data
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
          ? logs
              .map(l => `${l.created_at || `${l.event_date} ${l.event_time}`} — ${l.event_message}`)
              .join('\n\n')
          : 'No logs found.';
    } catch (err) {
      alert('Failed to fetch user: ' + (err?.error || JSON.stringify(err)));
    }
  }

  // Delete user from DB
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

  // event delegation for action buttons
  $('usersTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('viewBtn')) return viewUser(id);
    if (btn.classList.contains('delBtn')) return deleteUser(id);
  });

  // search
  $('btnSearch').addEventListener('click', async () => {
    const q = $('searchInput').value.trim();
    if (!q) { alert('Enter enrollment number'); return; }
    viewUser(q);
  });

  $('btnListAll').addEventListener('click', loadAllUsers);
  $('btnFetchAll').addEventListener('click', loadAllUsers);

  // Save server config
  $('btnReload').addEventListener('click', () => {
    SERVER_BASE = $('serverBase').value.replace(/\/$/, '') || SERVER_BASE;
    ADMIN_TOKEN = $('adminToken').value || ADMIN_TOKEN;
    localStorage.setItem('ap_server', SERVER_BASE);
    localStorage.setItem('ap_token', ADMIN_TOKEN);
    alert('Config saved!');
  });

  // detail view delete button
  $('btnDeleteUser').addEventListener('click', () => {
    const userId = $('detailTitle').textContent.replace(/^User:\s*/, '').trim();
    if (userId) deleteUser(userId);
  });

  // initial load
  loadAllUsers();

  // Press Enter to search
  $('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnSearch').click();
  });
})();
