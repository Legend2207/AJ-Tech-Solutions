const state = {
  user: null,
  services: [
    { id: 1, name: 'Website Development', icon: 'bi-globe2', description: 'High-converting web experiences with premium design and performance optimization.' },
    { id: 2, name: 'Software Development', icon: 'bi-code-square', description: 'Custom business software tailored to your internal workflows and growth goals.' },
    { id: 3, name: 'Mobile App Development', icon: 'bi-phone', description: 'Modern mobile solutions for Android, iOS, or cross-platform experiences.' },
    { id: 4, name: 'Networking', icon: 'bi-router', description: 'Secure networking, cabling, and infrastructure upgrades for modern teams.' },
    { id: 5, name: 'CCTV Installation', icon: 'bi-camera-video', description: 'Reliable surveillance systems designed for offices, homes, and retail sites.' },
    { id: 6, name: 'Cloud Solutions', icon: 'bi-cloud', description: 'Scalable cloud migration and managed infrastructure for modern organizations.' },
    { id: 7, name: 'Cybersecurity', icon: 'bi-shield-lock', description: 'Protect your systems with risk reviews, endpoint defense, and compliance planning.' },
    { id: 8, name: 'Computer Maintenance', icon: 'bi-pc-display', description: 'Proactive maintenance, hardware support, and device optimization.' },
    { id: 9, name: 'IT Consulting', icon: 'bi-people', description: 'Strategic guidance for digital operations, systems, staffing, and transformation.' },
    { id: 10, name: 'Graphics Design', icon: 'bi-brush', description: 'Brand visuals, presentations, marketing collateral, and UI design assets.' },
    { id: 11, name: 'Digital Branding', icon: 'bi-palette', description: 'Create a memorable visual identity with positioning and brand systems.' },
    { id: 12, name: 'IT Training & Facilitation', icon: 'bi-mortarboard', description: 'Hands-on training for teams and leadership across core technology topics.' }
  ],
  requests: [],
  notifications: [],
  payments: [],
  tickets: [],
  documents: [],
  socket: null,
  staffRequests: [],
  superadminCounts: {},
  superadminOverview: {},
  superadminUsers: [],
  superadminAdmins: [],
  superadminAccountRequests: [],
  superadminServices: [],
  superadminRequests: [],
  superadminContent: {},
  superadminSettings: {},
  superadminAudit: [],
  superadminNotifications: [],
  superadminBackups: [],
  superadminProfile: null,
  superadminPreferences: null,
  superadminLoginHistory: [],
  currentSuperadminUserId: null,
  currentSuperadminRequestId: null,
  chatContacts: [],
  activeChatContactId: null,
  chatMessages: [],
  adminOverview: {},
  clients: [],
  adminServices: [],
  adminRequests: [],
  adminNotifications: [],
  adminActivities: [],
  adminPermissions: {},
  currentClientId: null,
  currentRequestId: null
};

const refs = {
  loaderShell: document.getElementById('loaderShell'),
  authGate: document.getElementById('authGate'),
  appShell: document.querySelector('.app-shell'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  authSwitch: document.getElementById('authSwitch'),
  authSwitchText: document.getElementById('authSwitchText'),
  authError: document.getElementById('authError'),
  logoutButton: document.getElementById('logoutButton'),
  themeToggle: document.getElementById('themeToggle'),
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  mobileToggle: document.getElementById('mobileToggle'),
  overlay: document.getElementById('sidebarOverlay'),
  notificationDrawer: document.getElementById('notificationDrawer'),
  notificationsToggle: document.getElementById('notificationsToggle'),
  closeNotifications: document.getElementById('closeNotifications'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  requestModal: document.getElementById('requestModal'),
  closeModal: document.getElementById('closeModal'),
  cancelModal: document.getElementById('cancelModal'),
  requestForm: document.getElementById('requestForm'),
  serviceName: document.getElementById('serviceName'),
  currentDate: document.getElementById('currentDate'),
  toast: document.getElementById('toast'),
  notificationBadge: document.getElementById('notificationBadge'),
  dashboardNotifications: document.getElementById('dashboardNotifications'),
  drawerNotificationList: document.getElementById('drawerNotificationList'),
  servicesGrid: document.getElementById('servicesGrid'),
  requestsTableBody: document.getElementById('requestsTableBody'),
  requestDetailsContent: document.getElementById('requestDetailsContent'),
  outstandingInvoices: document.getElementById('outstandingInvoices'),
  paymentHistory: document.getElementById('paymentHistory'),
  ticketsList: document.getElementById('ticketsList'),
  documentsList: document.getElementById('documentsList'),
  documentsArchive: document.getElementById('documentsArchive'),
  notificationCenterList: document.getElementById('notificationCenterList')
};

const adminPageModules = {
  admin: 'overview',
  clients: 'clients',
  services: 'services',
  'requests-admin': 'requests',
  communications: 'communications',
  reports: 'reports',
  'admin-notifications': 'notifications',
  activity: 'activity',
  'admin-profile': 'profile'
};
let modalTrigger = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

async function fetchResponse(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    console.error('The application server could not be reached.', error);
    throw new Error('Cannot reach the AJ Tech Solutions server. Confirm it is running (npm start), then refresh the page.');
  }
}

async function apiRequest(url, options = {}) {
  const response = await fetchResponse(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const result = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : {};
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login' && url !== '/api/register') {
      showAuthGate();
    }
    throw new Error(result.message || 'The request could not be completed. Please try again.');
  }
  return result;
}

function setAuthError(message = '') {
  refs.authError.textContent = message;
  refs.authError.hidden = !message;
}

function hideLoader() {
  refs.loaderShell.classList.add('hidden');
  refs.loaderShell.setAttribute('aria-hidden', 'true');
}

function showAuthGate() {
  state.user = null;
  closeModal();
  setNotificationDrawer(false);
  state.requests = [];
  state.notifications = [];
  state.payments = [];
  state.documents = [];
  state.tickets = [];
  if (state.socket) state.socket.disconnect();
  state.socket = null;
  refs.appShell.hidden = true;
  refs.appShell.inert = false;
  refs.authGate.hidden = false;
  refs.loginForm.hidden = false;
  refs.registerForm.hidden = true;
  refs.registerForm.reset();
  updateRegistrationFields();
  document.getElementById('forcedPasswordForm').hidden = true;
  document.querySelector('.auth-switch').hidden = false;
  refs.authSwitch.textContent = 'Create an account';
  refs.authSwitchText.textContent = 'New to AJ Tech Solutions?';
  document.getElementById('authTitle').textContent = 'Sign in to your account';
  document.getElementById('authDescription').textContent = 'Access your requests and account.';
  setAuthError();
  hideLoader();
}

function showPortal(user) {
  state.user = user;
  const role = user.role || 'client';
  refs.authGate.hidden = true;
  document.getElementById('forcedPasswordForm').hidden = true;
  document.querySelector('.auth-switch').hidden = false;
  refs.appShell.hidden = false;
  document.querySelectorAll('[data-client-page]').forEach((element) => { element.hidden = role !== 'client'; });
  document.querySelectorAll('[data-role-page]').forEach((element) => {
    element.hidden = element.dataset.rolePage !== role;
  });
  document.querySelector('.brand-block p').textContent = role === 'client'
    ? 'Client Service Portal'
    : role === 'superadmin' ? 'Super-admin Workspace' : 'Admin Workspace';
  document.getElementById('profileName').textContent = user.fullName;
  document.querySelector('.profile-pill p').textContent = role === 'superadmin'
    ? 'Super admin'
    : role === 'admin' ? 'Admin' : 'Client';
  document.getElementById('supportProfileName').textContent = user.fullName;
  document.getElementById('accountProfileName').textContent = user.fullName;
  document.getElementById('supportProfileEmail').textContent = user.email;
  document.getElementById('accountProfileEmail').textContent = user.email;
  document.getElementById('clientName').value = user.fullName;
  document.getElementById('email').value = user.email;
}

function toggleAuthMode() {
  const registering = refs.registerForm.hidden;
  refs.registerForm.hidden = !registering;
  refs.loginForm.hidden = registering;
  updateRegistrationFields();
  refs.authSwitch.textContent = registering ? 'Sign in' : 'Create an account';
  refs.authSwitchText.textContent = registering ? 'Already have an account?' : 'New to AJ Tech Solutions?';
  document.getElementById('authTitle').textContent = registering ? 'Create your account' : 'Sign in to your account';
  if (!registering) document.getElementById('authDescription').textContent = 'Access your requests and account.';
  setAuthError();
}

function updateRegistrationFields() {
  const form = refs.registerForm;
  const isAdminRequest = form.elements.accountType.value === 'admin_request';
  const passwordLabel = document.getElementById('registrationPasswordLabel');
  form.elements.password.required = !isAdminRequest;
  passwordLabel.hidden = isAdminRequest;
  document.getElementById('registerSubmitButton').textContent = isAdminRequest ? 'Request Admin access' : 'Create account';
  document.getElementById('authDescription').textContent = isAdminRequest
    ? 'Admin access requests are reviewed by a Super Admin. No password is needed until your request is approved.'
    : 'Create an account to submit and track requests.';
}

async function submitAuthForm(event, endpoint) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setAuthError();
  const credentials = Object.fromEntries(new FormData(form).entries());
  const isAdminRequest = endpoint === '/api/register' && credentials.accountType === 'admin_request';
  delete credentials.accountType;
  if (isAdminRequest) delete credentials.password;
  try {
    const result = await apiRequest(isAdminRequest ? '/api/account-requests/admin' : endpoint, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    form.reset();
    updateRegistrationFields();
    if (isAdminRequest) {
      refs.registerForm.hidden = true;
      refs.loginForm.hidden = false;
      refs.authSwitchText.textContent = 'New to AJ Tech Solutions?';
      refs.authSwitch.textContent = 'Create an account';
      document.getElementById('authTitle').textContent = 'Sign in to your account';
      document.getElementById('authDescription').textContent = 'Access your requests and account.';
      setAuthError(result.message);
      return;
    }
    if (result.user.passwordResetRequired) {
      refs.loginForm.hidden = true;
      refs.registerForm.hidden = true;
      refs.authSwitch.parentElement.hidden = true;
      document.getElementById('authTitle').textContent = 'Set a new password';
      document.getElementById('authDescription').textContent = 'Your administrator issued a temporary password. Replace it before continuing.';
      const passwordForm = document.getElementById('forcedPasswordForm');
      passwordForm.hidden = false;
      passwordForm.elements.currentPassword.value = credentials.password;
      return;
    }
    showPortal(result.user);
    try {
      await loadPortalData();
    } catch (error) {
      showToast(error.message);
    }
    initializePortal();
  } catch (error) {
    setAuthError(error.message);
  } finally {
    submitButton.disabled = false;
  }
}

function updateDate() {
  refs.currentDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function applyTheme(theme) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', selectedTheme);
  refs.themeToggle.innerHTML = `<i class="bi ${selectedTheme === 'light' ? 'bi-moon' : 'bi-sun'}"></i>`;
  const themePreference = document.getElementById('themePreference');
  if (themePreference) themePreference.textContent = selectedTheme === 'light' ? 'Light' : 'Dark';
  try {
    localStorage.setItem('ajTheme', selectedTheme);
  } catch (error) {
    console.warn('Theme preference could not be saved:', error);
  }
}

function toggleSidebar(force) {
  const isOpen = typeof force === 'boolean' ? force : !refs.sidebar.classList.contains('open');
  refs.sidebar.classList.toggle('open', isOpen);
  refs.overlay.classList.toggle('open', isOpen);
}

function openModal(service = '') {
  modalTrigger = document.activeElement;
  if (service) refs.serviceName.value = service;
  if (state.user) {
    document.getElementById('clientName').value = state.user.fullName;
    document.getElementById('email').value = state.user.email;
  }
  refs.modalBackdrop.classList.add('open');
  refs.requestModal.classList.add('open');
  refs.requestModal.inert = false;
  refs.requestModal.setAttribute('aria-hidden', 'false');
  refs.appShell.inert = true;
  refs.serviceName.focus();
}

function closeModal() {
  refs.modalBackdrop.classList.remove('open');
  refs.requestModal.classList.remove('open');
  refs.requestModal.inert = true;
  refs.requestModal.setAttribute('aria-hidden', 'true');
  refs.appShell.inert = false;
  refs.requestForm.reset();
  if (modalTrigger && modalTrigger.isConnected) modalTrigger.focus();
  modalTrigger = null;
}

function setNotificationDrawer(open) {
  refs.notificationDrawer.classList.toggle('open', open);
  refs.notificationDrawer.inert = !open;
  refs.notificationDrawer.setAttribute('aria-hidden', String(!open));
  refs.notificationsToggle.setAttribute('aria-expanded', String(open));
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove('show'), 3500);
}

function emptyState(message) {
  return `<p class="empty-state">${escapeHTML(message)}</p>`;
}

function renderNotifications() {
  const render = (items) => items.map((item) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-bell"></i></div>
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.body)}</p>
        <p>${escapeHTML(formatDate(item.time))}</p>
        ${item.read ? '' : `<button class="text-btn" type="button" data-mark-notification="${Number(item.id)}">Mark as read</button>`}
      </div>
    </div>
  `).join('') || emptyState('You are all caught up. New updates will appear here.');
  refs.dashboardNotifications.innerHTML = render(state.notifications.slice(0, 4));
  refs.drawerNotificationList.innerHTML = render(state.notifications);
  refs.notificationCenterList.innerHTML = render(state.notifications);
  const unreadCount = state.notifications.filter((item) => !item.read).length;
  refs.notificationBadge.textContent = String(unreadCount);
  refs.notificationBadge.hidden = unreadCount === 0;
  refs.notificationsToggle.setAttribute(
    'aria-label',
    unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'
  );
  document.getElementById('markAllNotificationsRead').disabled = unreadCount === 0;
  document.getElementById('markDrawerNotificationsRead').disabled = unreadCount === 0;
}

function renderServices() {
  const search = document.getElementById('globalSearch').value.trim().toLowerCase();
  const services = state.services.filter((service) => `${service.name} ${service.description}`.toLowerCase().includes(search));
  refs.servicesGrid.innerHTML = services.map((service) => `
    <article class="service-card">
      ${service.image ? `<img class="service-image" src="${escapeHTML(service.image)}" alt="" loading="lazy" />` : `<div class="service-icon"><i class="bi ${escapeHTML(service.icon || 'bi-stars')}" aria-hidden="true"></i></div>`}
      <h3>${escapeHTML(service.name)}</h3>
      ${service.category ? `<span class="chip">${escapeHTML(service.category)}</span>` : ''}
      <p>${escapeHTML(service.description)}</p>
      <div class="service-meta">
        <span>${escapeHTML(service.price || 'Tailored project scope')}</span>
        <strong>${service.price ? 'Service price' : 'Request a quote'}</strong>
      </div>
      <button class="btn btn-primary" type="button" data-service-name="${escapeHTML(service.name)}">Request service</button>
    </article>
  `).join('') || emptyState('No services match your search.');
}

function renderRequestDetails(request) {
  if (!request) {
    refs.requestDetailsContent.innerHTML = emptyState('Select a request to see its details.');
    return;
  }
  const progress = Math.max(0, Math.min(100, Number(request.progress) || 0));
  refs.requestDetailsContent.innerHTML = `
    <div class="detail-card">
      <div class="detail-grid">
        <div><span>Request ID</span><strong>${escapeHTML(request.id)}</strong></div>
        <div><span>Service</span><strong>${escapeHTML(request.service)}</strong></div>
        <div><span>Status</span><strong>${escapeHTML(request.status)}</strong></div>
        <div><span>Priority</span><strong>${escapeHTML(request.priority)}</strong></div>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
        <i style="width:${progress}%"></i>
      </div>
      <p>${escapeHTML(request.details)}</p>
    </div>
  `;
}

function renderRequests() {
  const search = document.getElementById('requestSearch').value.trim().toLowerCase();
  const filtered = state.requests.filter((request) =>
    [request.id, request.service, request.status, request.assignedStaff].join(' ').toLowerCase().includes(search)
  );
  refs.requestsTableBody.innerHTML = filtered.map((request) => {
    const statusClass = String(request.status).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `
      <tr>
        <td>${escapeHTML(request.id)}</td>
        <td>${escapeHTML(request.service)}</td>
        <td>${escapeHTML(request.priority)}</td>
        <td><span class="badge ${statusClass}">${escapeHTML(request.status)}</span></td>
        <td>${escapeHTML(request.assignedStaff)}</td>
        <td>${escapeHTML(formatDate(request.created))}</td>
        <td>${escapeHTML(formatDate(request.expected))}</td>
        <td><button class="text-btn" data-request-id="${escapeHTML(request.id)}" type="button">View details</button></td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="8">${emptyState('No requests yet. Submit a service request to get started.')}</td></tr>`;
  renderRequestDetails(filtered[0] || state.requests[0]);
}

function renderPayments() {
  const outstanding = state.payments.filter((payment) => payment.status !== 'Paid');
  refs.outstandingInvoices.innerHTML = outstanding.map((payment) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-receipt"></i></div>
      <div>
        <strong>${escapeHTML(payment.id)}</strong>
        <p>Amount: ${escapeHTML(payment.amount)}</p>
        <p>Status: ${escapeHTML(payment.status)}</p>
        <p>Due: ${escapeHTML(formatDate(payment.due) || 'Not specified')}</p>
      </div>
    </div>
  `).join('') || emptyState('There are no outstanding invoices on your account.');
  refs.paymentHistory.innerHTML = state.payments.map((payment) => `
    <div class="setting-row">
      <span>${escapeHTML(payment.id)}</span>
      <span class="chip ${payment.status === 'Paid' ? 'chip-success' : ''}">${escapeHTML(payment.status)}</span>
    </div>
  `).join('') || emptyState('Payment history will appear here when available.');
}

function renderTickets() {
  const supportRequests = state.requests.filter((request) => request.service.toLowerCase().includes('support'));
  refs.ticketsList.innerHTML = supportRequests.map((ticket) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-ticket"></i></div>
      <div>
        <strong>${escapeHTML(ticket.service)}</strong>
        <p>${escapeHTML(ticket.id)}</p>
        <p>${escapeHTML(ticket.priority)} · ${escapeHTML(ticket.status)}</p>
      </div>
    </div>
  `).join('') || emptyState('No support requests yet. Submit one here and our team will follow up.');
}

function renderDocuments() {
  const items = state.documents.map((document) => `
    <div class="setting-row">
      <span>${escapeHTML(document.name)}</span>
      <span class="chip">${escapeHTML(document.type)}</span>
    </div>
  `).join('') || emptyState('Shared documents will appear here when available.');
  refs.documentsList.innerHTML = items;
  refs.documentsArchive.innerHTML = items;
}

function renderActivityTimeline() {
  const timeline = document.getElementById('activityTimeline');
  timeline.innerHTML = state.requests.length
    ? state.requests.slice(0, 4).map((request) => `
      <div class="timeline-item">
        <span class="timeline-dot"></span>
        <div><strong>${escapeHTML(request.service)} · ${escapeHTML(request.status)}</strong><p>${escapeHTML(formatDate(request.created))}</p></div>
      </div>
    `).join('')
    : emptyState('Activity for your requests will appear here.');
}

function renderStaffRequests() {
  const table = document.getElementById('staffRequests');
  if (!table) return;
  table.innerHTML = state.staffRequests.map((request) => `
    <tr>
      <td>${escapeHTML(request.id)}</td>
      <td>${escapeHTML(request.clientName)}<br><span class="muted">${escapeHTML(request.clientEmail)}</span></td>
      <td>${escapeHTML(request.service)}</td>
      <td><span class="badge ${String(request.status).toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${escapeHTML(request.status)}</span></td>
      <td>${escapeHTML(request.priority)}</td>
      <td>${escapeHTML(formatDate(request.createdAt))}</td>
      <td><button class="text-btn" type="button" data-admin-request-id="${escapeHTML(request.id)}">View / update</button><button class="text-btn" type="button" data-chat-contact-id="${Number(request.clientId)}">Message client</button></td>
    </tr>
  `).join('') || `<tr><td colspan="7">${emptyState('No client service requests yet.')}</td></tr>`;
}

function renderAdminDashboard() {
  const stats = state.adminOverview.stats || {};
  const values = {
    adminTotalClients: stats.totalClients,
    adminActiveClients: stats.activeClients,
    adminInactiveClients: stats.inactiveClients,
    adminPendingRequests: stats.pendingRequests,
    adminApprovedRequests: stats.approvedRequests,
    adminRejectedRequests: stats.rejectedRequests,
    adminCompletedRequests: stats.completedRequests,
    adminAvailableServices: stats.availableServices,
    adminOverdueRequests: stats.overdueRequests,
    adminRangeRegistrations: stats.registrationsInRange,
    adminRangeRequests: stats.requestsInRange
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? 0);
  });
  const activities = state.adminOverview.activities || state.adminActivities.slice(0, 10);
  document.getElementById('adminRecentActivity').innerHTML = renderAdminActivities(activities);
  document.getElementById('adminRecentNotifications').innerHTML =
    renderAdminNotifications(state.adminOverview.notifications || state.adminNotifications.slice(0, 10), true);
}

function renderAdminActivities(activities) {
  return activities.map((item) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-clock-history"></i></div>
      <div><strong>${escapeHTML(item.action)}</strong>
        <p>${escapeHTML(item.actor || `User ${item.actorId || ''}`)}${item.details ? ` · ${escapeHTML(item.details)}` : ''}</p>
        <p>${escapeHTML(formatDate(item.createdAt))}</p>
      </div>
    </div>
  `).join('') || emptyState('Administrative activity will appear here.');
}

function renderAdminNotifications(notifications, compact = false) {
  const items = compact ? notifications.slice(0, 6) : notifications;
  return items.map((item) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-bell"></i></div>
      <div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.body)}</p>
        <p>${escapeHTML(formatDate(item.createdAt || item.time))}</p>
        ${item.read ? '' : `<button class="text-btn" type="button" data-admin-notification-read="${Number(item.id)}">Mark read</button>`}
        ${compact ? '' : `<button class="text-btn" type="button" data-admin-notification-delete="${Number(item.id)}">Delete</button>`}
      </div>
    </div>
  `).join('') || emptyState('No notifications yet.');
}

function renderAdminClients() {
  const table = document.getElementById('clientsTable');
  if (!table) return;
  table.innerHTML = state.clients.map((client) => `
    <tr>
      <td>${escapeHTML(client.fullName)}</td>
      <td>${escapeHTML(client.email)}</td>
      <td>${escapeHTML(client.phone || '—')}</td>
      <td><span class="badge ${client.isActive ? 'completed' : 'cancelled'}">${client.isActive ? 'Active' : 'Inactive'}</span></td>
      <td>${escapeHTML(formatDate(client.registeredAt))}</td>
      <td>${escapeHTML(formatDate(client.lastLoginAt) || 'Never')}</td>
      <td><button class="text-btn" type="button" data-admin-client-id="${Number(client.id)}">View / edit</button></td>
    </tr>
  `).join('') || `<tr><td colspan="7">${emptyState('No clients match these filters.')}</td></tr>`;
  const clientSelect = document.getElementById('notificationClient');
  if (clientSelect) {
    const selected = clientSelect.value;
    clientSelect.innerHTML = '<option value="">Choose a client</option>' + state.clients
      .filter((client) => client.isActive)
      .map((client) => `<option value="${Number(client.id)}">${escapeHTML(client.fullName)} · ${escapeHTML(client.email)}</option>`)
      .join('');
    clientSelect.value = selected;
  }
}

function renderAdminServices() {
  const table = document.getElementById('servicesTable');
  if (!table) return;
  table.innerHTML = state.adminServices.map((service) => `
    <tr>
      <td>${escapeHTML(service.name)}${service.isArchived ? ' <span class="muted">(archived)</span>' : ''}</td>
      <td>${escapeHTML(service.category)}</td>
      <td>${escapeHTML(service.price || 'Quote')}</td>
      <td>${service.isAvailable ? 'Available' : 'Unavailable'}</td>
      <td>${service.isPublished ? 'Published' : 'Unpublished'}</td>
      <td>${service.isArchived ? '' : `<button class="text-btn" type="button" data-admin-service-edit="${Number(service.id)}">Edit</button><button class="text-btn" type="button" data-admin-service-archive="${Number(service.id)}">Archive</button>`}</td>
    </tr>
  `).join('') || `<tr><td colspan="6">${emptyState('No services have been added.')}</td></tr>`;
}

function renderAdminProfile() {
  const profile = state.adminProfile;
  const form = document.getElementById('adminProfileForm');
  if (profile && form) {
    form.elements.fullName.value = profile.fullName || '';
    form.elements.email.value = profile.email || '';
    form.elements.phone.value = profile.phone || '';
  }
  const preferences = state.adminPreferences;
  const preferencesForm = document.getElementById('adminPreferencesForm');
  if (preferences && preferencesForm) {
    preferencesForm.elements.emailEnabled.value = String(Boolean(preferences.emailEnabled));
    preferencesForm.elements.inAppEnabled.value = String(Boolean(preferences.inAppEnabled));
  }
  const historyList = (state.adminLoginHistory || []).map((item) => `
    <div class="setting-row"><span>${escapeHTML(item.action)} · ${escapeHTML(item.ipAddress || 'IP unavailable')}</span><span class="chip">${escapeHTML(formatDate(item.createdAt))}</span></div>
  `).join('') || emptyState('No login history is available.');
  document.getElementById('adminLoginHistory').innerHTML = historyList;
  const image = profile && profile.profileImage;
  const preview = document.getElementById('adminProfilePreview');
  const avatar = document.querySelector('.profile-pill .avatar');
  preview.hidden = !image;
  if (image) {
    preview.src = image;
    avatar.innerHTML = `<img src="${escapeHTML(image)}" alt="" />`;
  } else {
    preview.removeAttribute('src');
    avatar.textContent = 'AJ';
  }
}

function renderAdmin() {
  renderAdminDashboard();
  renderAdminClients();
  renderAdminServices();
  const assignee = document.querySelector('#requestUpdateForm [name="assignedTo"]');
  const selectedAssignee = assignee.value;
  const admins = [{ id: state.user.id, fullName: state.user.fullName }]
    .concat(state.chatContacts.filter((contact) => contact.role === 'admin'));
  assignee.innerHTML = '<option value="">Unassigned</option>' + admins
    .filter((contact, index) => admins.findIndex((item) => item.id === contact.id) === index)
    .map((contact) => `<option value="${Number(contact.id)}">${escapeHTML(contact.fullName)}</option>`)
    .join('');
  assignee.value = selectedAssignee;
  document.getElementById('adminNotifications').innerHTML = renderAdminNotifications(state.adminNotifications);
  document.getElementById('adminActivityLog').innerHTML = renderAdminActivities(state.adminActivities);
  renderAdminProfile();
  document.querySelectorAll('[data-role-page="admin"]').forEach((element) => {
    const page = element.dataset.page || element.id.replace(/^page-/, '');
    const module = adminPageModules[page];
    if (module) element.hidden = state.adminPermissions[module] === false;
  });
}

function renderSuperadminOverview() {
  const stats = state.superadminOverview.stats || {};
  const metrics = {
    superadminClients: stats.totalClients,
    superadminAdmins: stats.totalAdmins,
    superadminSuperadmins: stats.totalSuperadmins,
    superadminActiveUsers: stats.activeUsers,
    superadminSuspendedUsers: stats.suspendedUsers,
    superadminTotalRequests: stats.totalRequests,
    superadminPendingRequests: stats.pendingRequests,
    superadminApprovedRequests: stats.approvedRequests,
    superadminRejectedRequests: stats.rejectedRequests,
    superadminCompletedRequests: stats.completedRequests,
    superadminAvailableServices: stats.availableServices,
    superadminRangeRegistrations: stats.registrationsInRange,
    superadminRangeRequests: stats.requestsInRange
  };
  Object.entries(metrics).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value || 0);
  });
  const activity = state.superadminOverview.activity || [];
  document.getElementById('superadminRecentActivity').innerHTML = activity.map((item) => `
    <div class="setting-row"><span><strong>${escapeHTML(item.action)}</strong><br>${escapeHTML(item.actor || 'System')} · ${escapeHTML(item.details || item.entityType || '')}</span><span class="chip">${escapeHTML(formatDate(item.createdAt))}</span></div>
  `).join('') || emptyState('No activity in this date range.');
  const registrations = state.superadminOverview.registrations || [];
  document.getElementById('superadminRecentRegistrations').innerHTML = registrations.map((user) => `
    <div class="setting-row"><span><strong>${escapeHTML(user.fullName)}</strong><br>${escapeHTML(user.email)} · ${escapeHTML(user.role)}</span><span class="chip">${escapeHTML(formatDate(user.registeredAt))}</span></div>
  `).join('') || emptyState('No registrations in this date range.');
  const trends = state.superadminOverview.requestTrends || [];
  document.getElementById('superadminRequestTrends').innerHTML = trends.map((item) => `
    <div class="setting-row"><span>${escapeHTML(item.period)} · ${Number(item.requests)} requests</span><span class="chip">${Number(item.completed)} completed</span></div>
  `).join('') || emptyState('No request activity in this date range.');
}

function renderSuperadminUsers() {
  const rows = state.superadminUsers || [];
  document.getElementById('superadminUsersTable').innerHTML = rows.map((user) => `
    <tr>
      <td>${escapeHTML(user.fullName)}</td><td>${escapeHTML(user.email)}</td>
      <td>${escapeHTML(user.role)}</td><td>${user.isActive ? 'Active' : 'Suspended'}</td>
      <td>${escapeHTML(formatDate(user.registeredAt))}</td><td>${escapeHTML(formatDate(user.lastLoginAt) || 'Never')}</td>
      <td><button class="text-btn" type="button" data-open-superadmin-user="${Number(user.id)}">View / edit</button></td>
    </tr>
  `).join('') || `<tr><td colspan="7">${emptyState('No users match these filters.')}</td></tr>`;
  const admins = state.superadminAdmins || [];
  const selector = document.getElementById('superadminPermissionAdmin');
  const selected = selector.value;
  selector.innerHTML = admins.map((admin) => `<option value="${Number(admin.id)}">${escapeHTML(admin.fullName)} · ${escapeHTML(admin.email)}</option>`).join('');
  if (admins.some((admin) => String(admin.id) === selected)) selector.value = selected;
  document.getElementById('superadminAdminPerformance').innerHTML = admins.map((admin) => `
    <tr><td>${escapeHTML(admin.fullName)}<br>${escapeHTML(admin.email)}</td><td>${Number(admin.assignedRequests || 0)}</td>
      <td>${Number(admin.completedRequests || 0)}</td><td>${Number(admin.openRequests || 0)}</td>
      <td><button class="text-btn" type="button" data-admin-performance="${Number(admin.id)}">Refresh</button></td></tr>
  `).join('') || `<tr><td colspan="5">${emptyState('No administrator accounts found.')}</td></tr>`;
}

function renderSuperadminAccountRequests() {
  const requests = state.superadminAccountRequests || [];
  document.getElementById('superadminAccountRequestsTable').innerHTML = requests.map((request) => `
    <tr>
      <td>${escapeHTML(request.fullName)}</td><td>${escapeHTML(request.email)}</td>
      <td>${escapeHTML(request.phone || '—')}</td><td>${escapeHTML(formatDate(request.requestedAt))}</td>
      <td>
        <button class="text-btn" type="button" data-review-account-request="${Number(request.id)}" data-action="approve">Approve</button>
        <button class="text-btn" type="button" data-review-account-request="${Number(request.id)}" data-action="reject">Reject</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">${emptyState('No pending Admin access requests.')}</td></tr>`;
}

function renderSuperadminServices() {
  document.getElementById('superadminServicesTable').innerHTML = (state.superadminServices || []).map((service) => `
    <tr><td>${escapeHTML(service.name)}</td><td>${escapeHTML(service.category)}</td><td>${escapeHTML(service.price || 'Quote')}</td>
      <td>${service.isAvailable ? 'Available' : 'Unavailable'}</td><td>${service.isPublished ? 'Published' : 'Draft'}</td>
      <td>${service.isArchived ? 'Removed from catalog' : 'Active'}</td>
      <td>${service.isArchived ? '' : `<button class="text-btn" type="button" data-edit-superadmin-service="${Number(service.id)}">Edit</button>
      <button class="text-btn" type="button" data-archive-superadmin-service="${Number(service.id)}">Remove from catalog</button>`}</td></tr>
  `).join('') || `<tr><td colspan="7">${emptyState('No services have been created.')}</td></tr>`;
}

function renderSuperadminRequests() {
  document.getElementById('superadminRequestsTable').innerHTML = (state.superadminRequests || []).map((request) => `
    <tr><td>${escapeHTML(request.id)}</td><td>${escapeHTML(request.clientName || request.registeredName)}<br>${escapeHTML(request.clientEmail)}</td>
      <td>${escapeHTML(request.service)}</td><td>${escapeHTML(request.status)}</td>
      <td>${escapeHTML(request.assigneeName || 'Unassigned')}</td><td>${Number(request.progress) || 0}%</td>
      <td><button class="text-btn" type="button" data-open-superadmin-request="${escapeHTML(request.id)}">Details / update</button></td></tr>
  `).join('') || `<tr><td colspan="7">${emptyState('No service requests found.')}</td></tr>`;
  const assignment = document.querySelector('#superadminRequestForm [name="assignedTo"]');
  const admins = state.superadminAdmins.filter((user) => user.isActive);
  assignment.innerHTML = '<option value="">Unassigned</option>' + admins.map((admin) =>
    `<option value="${Number(admin.id)}">${escapeHTML(admin.fullName)}</option>`).join('');
}

function renderSuperadminContent() {
  const form = document.getElementById('superadminContentForm');
  const content = state.superadminContent || {};
  Object.keys(content).forEach((key) => {
    if (form.elements[key]) form.elements[key].value = content[key].value || '';
  });
  if (content.published !== undefined) form.elements.published.value = String(Boolean(content.published));
  const faqs = content.faq_json && content.faq_json.value;
  let parsedFaqs = [];
  try { parsedFaqs = JSON.parse(faqs || '[]'); } catch { parsedFaqs = []; }
  document.getElementById('superadminFaqPreview').innerHTML = parsedFaqs.map((faq) => `
    <div class="setting-row"><span><strong>${escapeHTML(faq.question)}</strong><br>${escapeHTML(faq.answer)}</span></div>
  `).join('');
}

function renderSuperadminSettings() {
  const form = document.getElementById('superadminSettingsForm');
  const settings = state.superadminSettings.settings || {};
  form.elements.maintenanceMode.value = settings.maintenance_mode || '0';
  form.elements.passwordMinLength.value = settings.password_min_length || '12';
  form.elements.sessionTimeoutMinutes.value = settings.session_timeout_minutes || '480';
  const system = state.superadminSettings.system || {};
  document.getElementById('superadminSystemStatus').innerHTML = `
    <div><span>Database</span><strong>${system.databaseConnected ? 'Connected' : 'Unavailable'}</strong></div>
    <div><span>Integrity check</span><strong>${escapeHTML(system.databaseIntegrity || 'Unknown')}</strong></div>
    <div><span>Database size</span><strong>${Number(system.databaseSize || 0).toLocaleString()} bytes</strong></div>
    <div><span>Node.js</span><strong>${escapeHTML(system.nodeVersion || 'Unknown')}</strong></div>
    <div><span>Process uptime</span><strong>${Number(system.uptimeSeconds || 0).toLocaleString()} seconds</strong></div>
  `;
}

function renderSuperadminAudit() {
  document.getElementById('superadminAuditTable').innerHTML = (state.superadminAudit || []).map((entry) => `
    <tr><td>${escapeHTML(formatDate(entry.createdAt))}</td><td>${escapeHTML(entry.actor || 'System')}</td>
      <td>${escapeHTML(entry.action)}</td><td>${escapeHTML(`${entry.entityType || ''} ${entry.entityId || ''}`)}</td>
      <td>${escapeHTML(entry.details || '')}</td></tr>
  `).join('') || `<tr><td colspan="5">${emptyState('No audit entries match these filters.')}</td></tr>`;
}

function renderSuperadminNotifications() {
  document.getElementById('superadminNotificationsList').innerHTML = (state.superadminNotifications || []).map((item) => `
    <div class="setting-row"><span><strong>${escapeHTML(item.title)}</strong><br>${escapeHTML(item.body || '')}<br>
      ${escapeHTML(item.recipientName || item.recipientEmail || 'Unknown user')} · ${escapeHTML(item.recipientRole || '')} · ${escapeHTML(formatDate(item.createdAt))}</span>
      <span>${item.read ? 'Read' : 'Unread'}${item.read ? '' : ` · <button class="text-btn" type="button" data-read-superadmin-notification="${Number(item.id)}">Mark read</button>`}</span></div>
  `).join('') || emptyState('No platform notifications yet.');
}

function renderSuperadminBackups() {
  document.getElementById('superadminBackupsList').innerHTML = (state.superadminBackups || []).map((backup) => `
    <div class="setting-row"><span><strong>${escapeHTML(backup.filename)}</strong><br>${escapeHTML(backup.createdBy || 'Unknown')} · ${escapeHTML(formatDate(backup.createdAt))}<br>${escapeHTML(backup.details || '')}</span>
      <span>${escapeHTML(backup.status)}${backup.status === 'completed' ? ` · <button class="text-btn" type="button" data-download-superadmin-backup="${Number(backup.id)}">Download</button>` : ''}</span></div>
  `).join('') || emptyState('No database backups have been created.');
}

function renderSuperadminProfile() {
  const profile = state.superadminProfile;
  if (!profile) return;
  const form = document.getElementById('superadminProfileForm');
  form.elements.fullName.value = profile.fullName || '';
  form.elements.email.value = profile.email || '';
  form.elements.phone.value = profile.phone || '';
  const preferences = state.superadminPreferences || {};
  const preferenceForm = document.getElementById('superadminPreferencesForm');
  preferenceForm.elements.emailEnabled.value = String(Boolean(preferences.emailEnabled));
  preferenceForm.elements.inAppEnabled.value = String(Boolean(preferences.inAppEnabled));
  document.getElementById('superadminLoginHistory').innerHTML = (state.superadminLoginHistory || []).map((item) => `
    <div class="setting-row"><span>${escapeHTML(item.action)} · ${escapeHTML(item.ipAddress || 'IP unavailable')}</span><span class="chip">${escapeHTML(formatDate(item.createdAt))}</span></div>
  `).join('') || emptyState('No login history is available.');
}

function renderSuperadmin() {
  if (!state.user || state.user.role !== 'superadmin') return;
  renderSuperadminOverview();
  renderSuperadminUsers();
  renderSuperadminAccountRequests();
  renderSuperadminServices();
  renderSuperadminRequests();
  renderSuperadminContent();
  renderSuperadminSettings();
  renderSuperadminAudit();
  renderSuperadminNotifications();
  renderSuperadminBackups();
  renderSuperadminProfile();
}

function renderChatContacts() {
  const list = document.getElementById('chatContacts');
  if (!list) return;
  if (!state.chatContacts.length) {
    const role = state.user && state.user.role || 'client';
    const description = role === 'client'
      ? 'No admins are available to message yet.'
      : role === 'admin'
        ? 'No clients or super admins are available to message yet.'
        : 'No admins are available to message yet.';
    list.innerHTML = emptyState(description);
    return;
  }
  list.innerHTML = state.chatContacts.map((contact) => `
    <button class="chat-contact${contact.id === state.activeChatContactId ? ' active' : ''}" type="button" data-chat-contact-id="${Number(contact.id)}">
      <strong>${escapeHTML(contact.fullName)}</strong>
      <span>${escapeHTML(contact.role === 'superadmin' ? 'Super admin' : contact.role === 'admin' ? 'Admin' : 'Client')}</span>
      <small>${escapeHTML(contact.lastMessage || 'Start a conversation')}</small>
    </button>
  `).join('');
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const contact = state.chatContacts.find((item) => item.id === state.activeChatContactId);
  const form = document.getElementById('chatForm');
  const submit = form.querySelector('[type="submit"]');
  const input = document.getElementById('chatInput');
  document.getElementById('chatContactName').textContent = contact ? contact.fullName : 'Select a conversation';
  input.disabled = !contact;
  submit.disabled = !contact;
  if (!contact) {
    container.innerHTML = emptyState('Choose a contact to view messages.');
    return;
  }
  container.innerHTML = state.chatMessages.map((message) => {
    const outbound = message.senderId === state.user.id;
    return `
      <article class="chat-message${outbound ? ' outbound' : ''}">
        <strong>${outbound ? 'You' : escapeHTML(contact.fullName)}</strong>
        <p>${escapeHTML(message.body)}</p>
        <time>${escapeHTML(formatDate(message.createdAt))}</time>
      </article>
    `;
  }).join('') || emptyState('No messages yet. Send a message to start the conversation.');
  container.scrollTop = container.scrollHeight;
}

async function loadChatMessages(contactId) {
  const id = Number(contactId);
  const contact = state.chatContacts.find((item) => item.id === id);
  if (!contact) return;
  state.activeChatContactId = id;
  state.chatMessages = [];
  renderChatContacts();
  renderChatMessages();
  try {
    const result = await apiRequest(`/api/chat/${id}/messages`);
    if (state.activeChatContactId !== id) return;
    state.chatMessages = result.messages || [];
    renderChatMessages();
  } catch (error) {
    showToast(error.message);
  }
}

function addChatMessage(message) {
  if (!state.chatMessages.some((item) => item.id === message.id) &&
      [message.senderId, message.recipientId].includes(state.user.id)) {
    const contactId = message.senderId === state.user.id ? message.recipientId : message.senderId;
    const contact = state.chatContacts.find((item) => item.id === contactId);
    if (contact) {
      contact.lastMessage = message.body;
      contact.lastMessageAt = message.createdAt;
      state.chatContacts.sort((first, second) =>
        String(second.lastMessageAt || '').localeCompare(String(first.lastMessageAt || ''))
      );
      renderChatContacts();
    }
    if (state.activeChatContactId === contactId) {
      state.chatMessages.push(message);
      renderChatMessages();
    } else {
      showToast('You have a new message.');
    }
  }
}

async function sendChatMessage(event) {
  event.preventDefault();
  const input = document.getElementById('chatInput');
  const button = event.currentTarget.querySelector('[type="submit"]');
  const body = input.value.trim();
  if (!body || !state.activeChatContactId) return;
  button.disabled = true;
  input.disabled = true;
  try {
    const result = await apiRequest('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ recipientId: state.activeChatContactId, body })
    });
    input.value = '';
    addChatMessage(result.message);
  } catch (error) {
    showToast(error.message);
  } finally {
    input.disabled = !state.activeChatContactId;
    button.disabled = !state.activeChatContactId;
  }
}

function animateCounters() {
  const counts = {
    active: state.requests.filter((request) => ['In Progress', 'In progress'].includes(request.status)).length,
    pending: state.requests.filter((request) => !['Completed', 'Cancelled'].includes(request.status)).length,
    completed: state.requests.filter((request) => request.status === 'Completed').length,
    tickets: state.requests.filter((request) =>
      request.service.toLowerCase().includes('support') && !['Completed', 'Cancelled'].includes(request.status)
    ).length
  };
  document.querySelectorAll('[data-metric]').forEach((item) => {
    item.textContent = String(counts[item.dataset.metric] || 0);
  });
}

function renderAll() {
  renderServices();
  renderRequests();
  renderNotifications();
  renderPayments();
  renderTickets();
  renderDocuments();
  renderActivityTimeline();
  renderServiceProgress();
  renderStaffRequests();
  if (state.user && state.user.role === 'admin') renderAdmin();
  renderSuperadmin();
  renderChatContacts();
  renderChatMessages();
  animateCounters();
}

async function markNotificationRead(id) {
  try {
    await apiRequest('/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ id: Number(id) })
    });
    const notification = state.notifications.find((item) => item.id === Number(id));
    if (notification) notification.read = true;
    renderNotifications();
  } catch (error) {
    showToast(error.message);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiRequest('/api/notifications/clear', { method: 'POST' });
    state.notifications.forEach((notification) => { notification.read = true; });
    renderNotifications();
    showToast('Notifications marked as read.');
  } catch (error) {
    showToast(error.message);
  }
}

function setPage(page, updateHistory = true) {
  const role = state.user ? state.user.role || 'client' : 'client';
  const allowedAdminPages = Object.keys(adminPageModules)
    .filter((adminPage) => state.adminPermissions[adminPageModules[adminPage]] !== false);
  const defaultPage = role === 'admin'
    ? allowedAdminPages[0] || 'messages'
    : role === 'superadmin' ? 'superadmin' : 'dashboard';
  const clientPages = ['dashboard', 'catalog', 'requests', 'billing', 'support', 'notifications', 'documents', 'profile', 'settings'];
  const adminPages = ['admin', 'clients', 'services', 'requests-admin', 'communications', 'reports', 'admin-notifications', 'activity', 'admin-profile'];
  const validPages = new Set(role === 'client' ? [...clientPages, 'messages']
    : role === 'admin' ? [...allowedAdminPages, 'messages'] : [defaultPage, 'messages']);
  const selected = validPages.has(page) ? page : defaultPage;
  document.querySelectorAll('.page').forEach((section) => section.classList.toggle('active', section.id === `page-${selected}`));
  document.querySelectorAll('.nav-link[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === selected));
  if (updateHistory && location.hash !== `#${selected}`) history.pushState({}, '', `#${selected}`);
  toggleSidebar(false);
}

function dateQuery(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params.toString();
}

async function refreshAdminOverview() {
  const query = dateQuery(document.getElementById('adminDateFrom').value, document.getElementById('adminDateTo').value);
  state.adminOverview = await apiRequest(`/api/admin/overview${query ? `?${query}` : ''}`);
  renderAdminDashboard();
}

async function refreshAdminClients() {
  const params = new URLSearchParams();
  const search = document.getElementById('clientSearch').value.trim();
  const status = document.getElementById('clientStatusFilter').value;
  const sort = document.getElementById('clientSort').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  const result = await apiRequest(`/api/admin/clients${params.size ? `?${params}` : ''}`);
  state.clients = result.clients || [];
  renderAdminClients();
}

async function refreshAdminRequests() {
  const params = new URLSearchParams();
  const status = document.getElementById('requestStatusFilter').value;
  const from = document.getElementById('requestDateFrom').value;
  const to = document.getElementById('requestDateTo').value;
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const result = await apiRequest(`/api/admin/requests${params.size ? `?${params}` : ''}`);
  state.adminRequests = result.requests || [];
  state.staffRequests = state.adminRequests;
  renderStaffRequests();
}

async function openAdminClient(id) {
  try {
    const [result, loginResult] = await Promise.all([
      apiRequest(`/api/admin/clients/${Number(id)}`),
      apiRequest(`/api/admin/clients/${Number(id)}/login-history`)
    ]);
    const client = result.client;
    state.currentClientId = Number(client.id);
    const form = document.getElementById('clientEditForm');
    form.elements.id.value = client.id;
    form.elements.fullName.value = client.fullName || '';
    form.elements.email.value = client.email || '';
    form.elements.phone.value = client.phone || '';
    form.elements.isActive.value = String(Boolean(client.isActive));
    form.elements.suspendedReason.value = client.suspendedReason || '';
    document.getElementById('clientProfileDetails').innerHTML = `
      <div><span>Client ID</span><strong>${Number(client.id)}</strong></div>
      <div><span>Registered</span><strong>${escapeHTML(formatDate(client.registeredAt))}</strong></div>
      <div><span>Last login</span><strong>${escapeHTML(formatDate(client.lastLoginAt) || 'Never')}</strong></div>
      <div><span>Account status</span><strong>${client.isActive ? 'Active' : `Suspended${client.suspendedReason ? ` · ${escapeHTML(client.suspendedReason)}` : ''}`}</strong></div>
    `;
    document.getElementById('clientRequestHistory').innerHTML = (result.requests || []).map((request) => `
      <div class="setting-row"><span>${escapeHTML(request.id)} · ${escapeHTML(request.service)} · ${escapeHTML(request.status)}</span><span class="chip">${escapeHTML(formatDate(request.createdAt))}</span></div>
    `).join('') || emptyState('This client has no service requests.');
    document.getElementById('clientLoginHistory').innerHTML = (loginResult.history || []).map((item) => `
      <div class="setting-row"><span>${escapeHTML(item.action)} · ${escapeHTML(item.ipAddress || 'IP unavailable')}</span><span class="chip">${escapeHTML(formatDate(item.createdAt))}</span></div>
    `).join('') || emptyState('No login history is available.');
    document.getElementById('clientEditorTitle').textContent = `Client profile · ${client.fullName}`;
    document.getElementById('clientEditor').hidden = false;
    document.getElementById('clientEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message);
  }
}

async function openAdminRequest(id) {
  try {
    const result = await apiRequest(`/api/admin/requests/${encodeURIComponent(id)}`);
    const request = result.request;
    state.currentRequestId = request.id;
    const form = document.getElementById('requestUpdateForm');
    form.elements.id.value = request.id;
    form.elements.status.value = request.status || 'New';
    form.elements.progress.value = Number(request.progress) || 0;
    form.elements.assignedTo.value = request.assigned_to || '';
    const details = [
      ['Client', request.client_name || request.registeredName],
      ['Email', request.email || request.accountEmail],
      ['Phone', request.phone || request.accountPhone],
      ['Service', request.service_name],
      ['Status', request.status],
      ['Priority', request.priority],
      ['Preferred date', request.preferred_start_date],
      ['Estimated budget', request.estimated_budget],
      ['Description', request.description],
      ['Additional notes', request.additional_notes],
      ['Attached files', request.documents]
    ];
    document.getElementById('requestProfileDetails').innerHTML = details.map(([label, value]) => `
      <div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value || '—')}</strong></div>
    `).join('');
    document.getElementById('requestEditorTitle').textContent = `Request details · ${request.id}`;
    document.getElementById('requestHistory').innerHTML = (result.history || []).map((item) => `
      <div class="setting-row"><span>${escapeHTML(item.action)}${item.details ? ` · ${escapeHTML(item.details)}` : ''}</span><span class="chip">${escapeHTML(formatDate(item.createdAt))}</span></div>
    `).join('') || emptyState('No request status history is available.');
    document.getElementById('requestNotes').innerHTML = (result.notes || []).map((item) => `
      <div class="notification-item"><div><strong>${escapeHTML(item.author || 'Admin')} · ${item.isInternal ? 'Internal' : 'Client update'}</strong><p>${escapeHTML(item.body)}</p><p>${escapeHTML(formatDate(item.createdAt))}</p></div></div>
    `).join('') || emptyState('No notes have been added.');
    document.getElementById('requestEditor').hidden = false;
    document.getElementById('requestEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message);
  }
}

function dateQueryFromForm(formId) {
  const form = document.getElementById(formId);
  return new URLSearchParams(new FormData(form)).toString();
}

async function refreshSuperadminOverview() {
  const query = dateQuery(document.getElementById('superadminDateFrom').value, document.getElementById('superadminDateTo').value);
  state.superadminOverview = await apiRequest(`/api/superadmin/overview${query ? `?${query}` : ''}`);
  renderSuperadminOverview();
}

async function refreshSuperadminUsers() {
  const params = new URLSearchParams();
  const search = document.getElementById('superadminUserSearch').value.trim();
  const role = document.getElementById('superadminUserRole').value;
  const status = document.getElementById('superadminUserStatus').value;
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const [result, admins, accountRequests] = await Promise.all([
    apiRequest(`/api/superadmin/users${params.size ? `?${params}` : ''}`),
    apiRequest('/api/superadmin/users?role=admin'),
    apiRequest('/api/superadmin/account-requests?status=pending')
  ]);
  state.superadminUsers = result.users || [];
  state.superadminAdmins = admins.users || [];
  state.superadminAccountRequests = accountRequests.requests || [];
  renderSuperadminUsers();
  renderSuperadminAccountRequests();
  renderSuperadminRequests();
}

async function refreshSuperadminAccountRequests() {
  const result = await apiRequest('/api/superadmin/account-requests?status=pending');
  state.superadminAccountRequests = result.requests || [];
  renderSuperadminAccountRequests();
}

async function refreshSuperadminRequests() {
  const status = document.getElementById('superadminRequestStatus').value;
  const result = await apiRequest(`/api/admin/requests${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  state.superadminRequests = result.requests || [];
  renderSuperadminRequests();
}

async function refreshSuperadminServices() {
  const result = await apiRequest('/api/admin/services');
  state.superadminServices = result.services || [];
  renderSuperadminServices();
}

async function refreshSuperadminAudit() {
  const params = new URLSearchParams();
  const search = document.getElementById('superadminAuditSearch').value.trim();
  if (search) params.set('search', search);
  const result = await apiRequest(`/api/superadmin/audit${params.size ? `?${params}` : ''}`);
  state.superadminAudit = result.entries || [];
  renderSuperadminAudit();
}

async function refreshSuperadminNotifications() {
  const search = document.getElementById('superadminNotificationSearch').value.trim();
  const result = await apiRequest(`/api/superadmin/notifications${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  state.superadminNotifications = result.notifications || [];
  renderSuperadminNotifications();
}

async function openSuperadminUser(id) {
  try {
    const result = await apiRequest(`/api/superadmin/users/${Number(id)}`);
    const user = result.user;
    state.currentSuperadminUserId = Number(user.id);
    const form = document.getElementById('superadminUserForm');
    form.elements.id.value = user.id;
    form.elements.fullName.value = user.fullName || '';
    form.elements.email.value = user.email || '';
    form.elements.phone.value = user.phone || '';
    form.elements.role.value = user.role;
    form.elements.isActive.value = String(Boolean(user.isActive));
    form.elements.suspendedReason.value = user.suspendedReason || '';
    document.getElementById('superadminUserEditorTitle').textContent = `${user.role} profile · ${user.fullName}`;
    document.getElementById('superadminUserDetails').innerHTML = `
      <div class="detail-grid">
        <div><span>Registered</span><strong>${escapeHTML(formatDate(user.registeredAt))}</strong></div>
        <div><span>Last login</span><strong>${escapeHTML(formatDate(user.lastLoginAt) || 'Never')}</strong></div>
        <div><span>Requests</span><strong>${Number(result.requestStats.total)} total · ${Number(result.requestStats.completed)} completed · ${Number(result.requestStats.active)} open</strong></div>
      </div>
      <h3>Recent account activity</h3>${(result.activities || []).map((item) =>
        `<div class="setting-row"><span>${escapeHTML(item.action)} · ${escapeHTML(item.details || '')}</span><span>${escapeHTML(formatDate(item.createdAt))}</span></div>`
      ).join('') || emptyState('No account activity recorded.')}
      <h3>Login history</h3>${(result.loginHistory || []).map((item) =>
        `<div class="setting-row"><span>${escapeHTML(item.action)} · ${escapeHTML(item.ipAddress || '')}</span><span>${escapeHTML(formatDate(item.createdAt))}</span></div>`
      ).join('') || emptyState('No login history available.')}
      <h3>Requests</h3>${(result.requests || []).map((item) =>
        `<div class="setting-row"><span>${escapeHTML(item.id)} · ${escapeHTML(item.service)} · ${escapeHTML(item.status)}</span><span>${escapeHTML(formatDate(item.createdAt))}</span></div>`
      ).join('') || emptyState('No requests associated with this account.')}
    `;
    document.getElementById('superadminUserEditor').hidden = false;
    document.getElementById('superadminUserEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message);
  }
}

async function loadSuperadminPermissions() {
  const adminId = Number(document.getElementById('superadminPermissionAdmin').value);
  if (!adminId) return;
  try {
    const result = await apiRequest(`/api/superadmin/admins/${adminId}/permissions`);
    Object.entries(result.permissions).forEach(([module, allowed]) => {
      const input = document.querySelector(`#superadminPermissionsForm [name="${module}"]`);
      if (input) input.checked = Boolean(allowed);
    });
  } catch (error) {
    showToast(error.message);
  }
}

async function openSuperadminRequest(id) {
  try {
    const result = await apiRequest(`/api/admin/requests/${encodeURIComponent(id)}`);
    const request = result.request;
    state.currentSuperadminRequestId = request.id;
    const form = document.getElementById('superadminRequestForm');
    form.elements.id.value = request.id;
    form.elements.status.value = request.status || 'New';
    form.elements.progress.value = Number(request.progress) || 0;
    form.elements.assignedTo.value = request.assigned_to || '';
    document.getElementById('superadminRequestEditorTitle').textContent = `Request details · ${request.id}`;
    const details = [
      ['Client', request.client_name || request.registeredName], ['Email', request.email || request.accountEmail],
      ['Phone', request.phone || request.accountPhone], ['Service', request.service_name], ['Status', request.status],
      ['Priority', request.priority], ['Description', request.description], ['Documents / references', request.documents],
      ['Additional notes', request.additional_notes]
    ];
    document.getElementById('superadminRequestDetails').innerHTML = `<div class="detail-grid">${details.map(([label, value]) =>
      `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value || '—')}</strong></div>`
    ).join('')}</div>`;
    document.getElementById('superadminRequestHistory').innerHTML = (result.history || []).map((item) =>
      `<div class="setting-row"><span>${escapeHTML(item.action)} · ${escapeHTML(item.details || '')}</span><span>${escapeHTML(formatDate(item.createdAt))}</span></div>`
    ).join('') || emptyState('No request history.');
    document.getElementById('superadminRequestNotes').innerHTML = (result.notes || []).map((item) =>
      `<div class="setting-row"><span>${escapeHTML(item.author || 'Staff')} · ${item.isInternal ? 'Internal' : 'Client'}: ${escapeHTML(item.body)}</span><span>${escapeHTML(formatDate(item.createdAt))}</span></div>`
    ).join('') || emptyState('No request notes.');
    document.getElementById('superadminRequestEditor').hidden = false;
    document.getElementById('superadminRequestEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message);
  }
}

function selectSuperadminTab(name) {
  const tabs = document.querySelectorAll('[data-superadmin-tab]');
  if (![...tabs].some((tab) => tab.dataset.superadminTab === name)) return;
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.superadminTab === name));
  document.querySelectorAll('.superadmin-panel').forEach((panel) => {
    panel.hidden = panel.id !== `superadminSection-${name}`;
  });
  if (name === 'permissions') loadSuperadminPermissions();
  if (name === 'users') refreshSuperadminAccountRequests().catch((error) => showToast(error.message));
  if (name === 'audit') refreshSuperadminAudit().catch((error) => showToast(error.message));
  if (name === 'notifications') refreshSuperadminNotifications().catch((error) => showToast(error.message));
}

function openServiceEditor(service = null) {
  const form = document.getElementById('serviceForm');
  form.reset();
  form.elements.id.value = service ? service.id : '';
  if (service) {
    form.elements.name.value = service.name;
    form.elements.category.value = service.category;
    form.elements.description.value = service.description;
    form.elements.price.value = service.price || '';
    form.elements.isAvailable.value = String(Boolean(service.isAvailable));
    form.elements.isPublished.value = String(Boolean(service.isPublished));
  }
  document.getElementById('serviceEditorTitle').textContent = service ? `Edit service · ${service.name}` : 'Add service';
  document.getElementById('serviceImageForm').hidden = !service;
  document.getElementById('serviceImageForm').elements.id.value = service ? service.id : '';
  document.getElementById('serviceEditor').hidden = false;
  document.getElementById('serviceEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function uploadImage(url, file) {
  const body = new FormData();
  body.append('image', file);
  const response = await fetchResponse(url, { method: 'POST', credentials: 'same-origin', body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'The image upload failed.');
  return result;
}

async function submitReport(format, formId = 'reportForm') {
  const form = document.getElementById(formId);
  const params = new URLSearchParams(new FormData(form));
  try {
    const response = await fetchResponse(`/api/admin/reports/${format}?${params}`, { credentials: 'same-origin' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to export the report.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `aj-report.${format}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast(`${format.toUpperCase()} report downloaded.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function loadPortalData() {
  const role = state.user.role || 'client';
  let adminPermissionData = { permissions: {} };
  if (role === 'admin') {
    state.adminPermissions = {};
    adminPermissionData = await apiRequest('/api/admin/permissions');
    state.adminPermissions = adminPermissionData.permissions || {};
  }
  const canLoadAdminModule = (module) => role === 'admin' && state.adminPermissions[module] !== false;
  const [requests, payments, documents, notifications, contacts, overview, services, clients, adminServices, adminRequests, adminNotifications, activities, profile, preferences, loginHistory] = await Promise.all([
    role === 'client' ? apiRequest('/api/service-requests') : Promise.resolve({ requests: [] }),
    role === 'client' ? apiRequest('/api/payments') : Promise.resolve({ payments: [] }),
    role === 'client' ? apiRequest('/api/documents') : Promise.resolve({ documents: [] }),
    role === 'client' ? apiRequest('/api/notifications') : Promise.resolve({ notifications: [] }),
    apiRequest('/api/chat/contacts'),
    role === 'superadmin' ? apiRequest('/api/superadmin/overview') :
      canLoadAdminModule('overview') ? apiRequest('/api/admin/overview') : Promise.resolve({ stats: {}, activities: [], notifications: [] }),
    role === 'client' ? apiRequest('/api/services') : Promise.resolve({ services: [] }),
    canLoadAdminModule('clients') ? apiRequest('/api/admin/clients') : Promise.resolve({ clients: [] }),
    canLoadAdminModule('services') ? apiRequest('/api/admin/services') : Promise.resolve({ services: [] }),
    canLoadAdminModule('requests') ? apiRequest('/api/admin/requests') : Promise.resolve({ requests: [] }),
    canLoadAdminModule('notifications') ? apiRequest('/api/admin/notifications') : Promise.resolve({ notifications: [] }),
    canLoadAdminModule('activity') ? apiRequest('/api/admin/activity') : Promise.resolve({ activities: [] }),
    canLoadAdminModule('profile') ? apiRequest('/api/admin/profile') : Promise.resolve({ profile: null }),
    canLoadAdminModule('profile') ? apiRequest('/api/admin/preferences') : Promise.resolve({ preferences: null }),
    canLoadAdminModule('profile') ? apiRequest('/api/admin/login-history') : Promise.resolve({ history: [] })
  ]);
  state.requests = role === 'client' ? requests.requests || [] : [];
  state.payments = payments.payments || [];
  state.documents = documents.documents || [];
  state.notifications = notifications.notifications || [];
  state.chatContacts = contacts.contacts || [];
  if (role === 'client') {
    state.services = services.services || [];
  } else if (role === 'admin') {
    state.adminOverview = overview;
    state.clients = clients.clients || [];
    state.adminServices = adminServices.services || [];
    state.adminRequests = adminRequests.requests || [];
    state.staffRequests = state.adminRequests;
    state.adminNotifications = adminNotifications.notifications || [];
    state.adminActivities = activities.activities || [];
    state.adminProfile = profile.profile;
    state.adminPreferences = preferences.preferences;
    state.adminLoginHistory = loginHistory.history || [];
  } else if (role === 'superadmin') {
    const [users, admins, accountRequests, adminServices, adminRequests, content, settings, audit, adminNotifications, backups, profile, loginHistory, preferences] = await Promise.all([
      apiRequest('/api/superadmin/users'),
      apiRequest('/api/superadmin/users?role=admin'),
      apiRequest('/api/superadmin/account-requests?status=pending'),
      apiRequest('/api/admin/services'),
      apiRequest('/api/admin/requests'),
      apiRequest('/api/superadmin/content'),
      apiRequest('/api/superadmin/settings'),
      apiRequest('/api/superadmin/audit'),
      apiRequest('/api/superadmin/notifications'),
      apiRequest('/api/superadmin/backups'),
      apiRequest('/api/admin/profile'),
      apiRequest('/api/admin/login-history'),
      apiRequest('/api/admin/preferences')
    ]);
    state.superadminOverview = overview;
    state.superadminUsers = users.users || [];
    state.superadminAdmins = admins.users || [];
    state.superadminAccountRequests = accountRequests.requests || [];
    state.superadminServices = adminServices.services || [];
    state.superadminRequests = adminRequests.requests || [];
    const contentRows = content.content || [];
    state.superadminContent = Object.fromEntries(contentRows.map((item) => [item.key, item]));
    state.superadminContent.published = contentRows.every((item) => item.isPublished);
    state.superadminSettings = settings;
    state.superadminAudit = audit.entries || [];
    state.superadminNotifications = adminNotifications.notifications || [];
    state.superadminBackups = backups.backups || [];
    state.superadminProfile = profile.profile;
    state.superadminLoginHistory = loginHistory.history || [];
    state.superadminPreferences = preferences.preferences;
  }
  if (!state.chatContacts.some((contact) => contact.id === state.activeChatContactId)) {
    state.activeChatContactId = state.chatContacts.length ? state.chatContacts[0].id : null;
  }
  if (state.activeChatContactId) await loadChatMessages(state.activeChatContactId);
}

async function loadPublicSiteContent() {
  try {
    const result = await apiRequest('/api/public/site');
    const content = result.content || {};
    if (content.company_name) {
      document.title = `${content.company_name} | Business Technology Services`;
      document.querySelectorAll('.brand-block h3').forEach((element) => { element.textContent = content.company_name; });
      document.querySelector('#authGate .eyebrow').textContent = content.company_name;
    }
    if (content.hero_headline) document.getElementById('businessTitle').textContent = content.hero_headline;
    if (content.hero_intro) document.getElementById('publicSiteIntro').textContent = content.hero_intro;
    document.getElementById('publicSiteAbout').textContent = content.about_text || '';
    document.getElementById('publicSiteAnnouncement').textContent = content.announcement || '';
    const contacts = [content.contact_email, content.contact_phone, content.contact_address].filter(Boolean);
    document.getElementById('publicSiteContact').textContent = contacts.join(' · ');
    document.getElementById('publicMaintenanceNotice').hidden = !result.maintenanceMode;
    const faqContainer = document.getElementById('publicFaqList');
    try {
      const faqs = JSON.parse(content.faq_json || '[]');
      faqContainer.innerHTML = Array.isArray(faqs) ? faqs.map((faq) =>
        `<details><summary>${escapeHTML(faq.question)}</summary><p>${escapeHTML(faq.answer)}</p></details>`
      ).join('') : '';
    } catch (error) {
      console.error('Published FAQ content is invalid:', error);
    }
    const logo = content.company_logo;
    if (logo && /^\/uploads\/[a-f0-9]{48}\.(png|jpg|webp)$/.test(logo)) {
      document.querySelectorAll('.brand-logo').forEach((image) => { image.src = logo; });
    }
    const banner = content.banner_image;
    if (banner && /^\/uploads\/[a-f0-9]{48}\.(png|jpg|webp)$/.test(banner)) {
      document.querySelector('.auth-overview').style.backgroundImage = `linear-gradient(rgba(6, 11, 24, .82), rgba(6, 11, 24, .94)), url("${banner}")`;
    }
    document.getElementById('publicServiceList').innerHTML = (result.services || []).map((service) => `
      <article class="public-service-card"><strong>${escapeHTML(service.name)}</strong><span>${escapeHTML(service.category)}</span><p>${escapeHTML(service.description)}</p></article>
    `).join('');
    return result;
  } catch (error) {
    console.error('Public website content could not be loaded:', error);
    return null;
  }
}

function renderServiceProgress() {
  const chart = document.getElementById('progressChart');
  const emptyState = document.getElementById('progressChartEmpty');
  if (!chart || !emptyState) return;
  const total = state.requests.length;
  emptyState.hidden = total > 0;
  chart.hidden = total === 0;
  if (total === 0) {
    chart.replaceChildren();
    return;
  }

  const statuses = [
    { label: 'In progress', className: 'in-progress', count: 0 },
    { label: 'Awaiting action', className: 'awaiting', count: 0 },
    { label: 'Completed', className: 'completed', count: 0 },
    { label: 'Cancelled', className: 'cancelled', count: 0 }
  ];
  state.requests.forEach((request) => {
    const status = String(request.status).toLowerCase();
    const category = status === 'completed'
      ? statuses[2]
      : status === 'cancelled'
        ? statuses[3]
        : status === 'in progress'
          ? statuses[0]
          : statuses[1];
    category.count += 1;
  });

  chart.innerHTML = statuses.map(({ label, className, count }) => {
    const percentage = (count / total) * 100;
    return `
      <div class="progress-status ${className}">
        <div class="progress-status-head"><span>${label}</span><strong>${count}</strong></div>
        <div class="progress-track" role="progressbar" aria-label="${label}" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${total}">
          <span style="width: ${percentage}%"></span>
        </div>
      </div>
    `;
  }).join('');
}

async function submitRequest(event) {
  event.preventDefault();
  const submitButton = refs.requestForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  const formData = new FormData(refs.requestForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const result = await apiRequest('/api/service-requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const request = result.request;
    state.requests.unshift({
      id: request.id,
      service: request.serviceName,
      priority: request.priority,
      status: request.status,
      assignedStaff: 'Pending assignment',
      created: 'Just now',
      expected: payload.preferredStartDate || 'To be confirmed',
      progress: 0,
      details: request.details
    });
    if (result.notification && !state.notifications.some((item) => item.id === result.notification.id)) {
      state.notifications.unshift(result.notification);
    }
    renderAll();
    closeModal();
    showToast(`Request ${request.id} was submitted successfully.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function signOut() {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
    if (state.socket) state.socket.disconnect();
    state.socket = null;
    showAuthGate();
    setPage('dashboard', false);
  } catch (error) {
    showToast(error.message);
  }
}

function initializeEvents() {
  refs.loginForm.addEventListener('submit', (event) => submitAuthForm(event, '/api/login'));
  refs.registerForm.addEventListener('submit', (event) => submitAuthForm(event, '/api/register'));
  refs.registerForm.elements.accountType.addEventListener('change', updateRegistrationFields);
  document.getElementById('forcedPasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.elements.newPassword.value !== form.elements.confirmPassword.value) {
      setAuthError('The new passwords do not match.');
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await apiRequest('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.elements.currentPassword.value,
          newPassword: form.elements.newPassword.value
        })
      });
      form.reset();
      const current = await apiRequest('/api/me');
      showPortal(current.user);
      await loadPortalData();
      initializePortal();
      showToast('Temporary password replaced successfully.');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      button.disabled = false;
    }
  });
  refs.authSwitch.addEventListener('click', toggleAuthMode);
  refs.logoutButton.addEventListener('click', signOut);
  refs.themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  refs.sidebarToggle.addEventListener('click', () => toggleSidebar());
  refs.mobileToggle.addEventListener('click', () => toggleSidebar(true));
  refs.overlay.addEventListener('click', () => toggleSidebar(false));
  refs.notificationsToggle.addEventListener('click', () => {
    setNotificationDrawer(refs.notificationsToggle.getAttribute('aria-expanded') !== 'true');
  });
  refs.closeNotifications.addEventListener('click', () => setNotificationDrawer(false));
  refs.closeModal.addEventListener('click', closeModal);
  refs.cancelModal.addEventListener('click', closeModal);
  refs.modalBackdrop.addEventListener('click', closeModal);
  refs.requestForm.addEventListener('submit', submitRequest);
  document.getElementById('chatForm').addEventListener('submit', sendChatMessage);
  document.querySelectorAll('[data-superadmin-tab]').forEach((button) => {
    button.addEventListener('click', () => selectSuperadminTab(button.dataset.superadminTab));
  });
  document.getElementById('refreshSuperadminOverview').addEventListener('click', () => refreshSuperadminOverview().catch((error) => showToast(error.message)));
  document.getElementById('searchSuperadminUsers').addEventListener('click', () => refreshSuperadminUsers().catch((error) => showToast(error.message)));
  document.getElementById('refreshSuperadminAccountRequests').addEventListener('click', () =>
    refreshSuperadminAccountRequests().catch((error) => showToast(error.message)));
  document.getElementById('superadminUserSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') refreshSuperadminUsers().catch((error) => showToast(error.message));
  });
  document.getElementById('superadminUserRole').addEventListener('change', () => refreshSuperadminUsers().catch((error) => showToast(error.message)));
  document.getElementById('superadminUserStatus').addEventListener('change', () => refreshSuperadminUsers().catch((error) => showToast(error.message)));
  document.getElementById('closeSuperadminUserEditor').addEventListener('click', () => { document.getElementById('superadminUserEditor').hidden = true; });
  const createPrivilegedAccountForm = document.getElementById('superadminCreateAdminForm');
  createPrivilegedAccountForm.elements.role.addEventListener('change', () => {
    const isSuperadmin = createPrivilegedAccountForm.elements.role.value === 'superadmin';
    document.getElementById('superadminInitialPasswordLabel').hidden = !isSuperadmin;
    if (!isSuperadmin) createPrivilegedAccountForm.elements.password.value = '';
  });
  createPrivilegedAccountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await apiRequest('/api/superadmin/users', { method: 'POST', body: JSON.stringify(payload) });
      const password = document.getElementById('superadminTemporaryPassword');
      if (result.temporaryPassword) {
        password.textContent = `Copy this one-time temporary password for ${payload.email}: ${result.temporaryPassword}`;
        password.hidden = false;
      } else {
        password.hidden = true;
        password.textContent = '';
      }
      form.reset();
      form.elements.role.dispatchEvent(new Event('change'));
      await refreshSuperadminUsers();
      showToast(`${payload.role === 'superadmin' ? 'Super Admin' : 'Admin'} account created.`);
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminAccountRequestsTable').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-review-account-request]');
    if (!button) return;
    const action = button.dataset.action;
    const id = Number(button.dataset.reviewAccountRequest);
    if (action === 'reject' && !window.confirm('Reject this Admin account request?')) return;
    try {
      const result = await apiRequest(`/api/superadmin/account-requests/${id}/review`, {
        method: 'POST', body: JSON.stringify({ action })
      });
      if (result.temporaryPassword) {
        const password = document.getElementById('superadminTemporaryPassword');
        password.textContent = `Copy this one-time temporary password for the approved Admin: ${result.temporaryPassword}`;
        password.hidden = false;
      }
      await refreshSuperadminUsers();
      showToast(result.message);
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.isActive = payload.isActive === 'true';
    const id = Number(payload.id);
    delete payload.id;
    try {
      await apiRequest(`/api/superadmin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await refreshSuperadminUsers();
      await openSuperadminUser(id);
      showToast('User account updated.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('resetSuperadminUserPassword').addEventListener('click', async () => {
    const id = state.currentSuperadminUserId;
    if (!id || !window.confirm('Reset this account password? Existing sessions will be revoked.')) return;
    try {
      const result = await apiRequest(`/api/superadmin/users/${id}/reset-password`, { method: 'POST' });
      const output = document.getElementById('superadminTemporaryPassword');
      output.textContent = `Copy this one-time temporary password for user ${id}: ${result.temporaryPassword}`;
      output.hidden = false;
      showToast('Password reset. The user must change it at next sign-in.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminPermissionAdmin').addEventListener('change', loadSuperadminPermissions);
  document.getElementById('superadminPermissionsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const permissions = {};
    ['overview', 'clients', 'services', 'requests', 'communications', 'reports', 'notifications', 'activity', 'profile'].forEach((module) => {
      permissions[module] = form.elements[module].checked;
    });
    const adminId = Number(form.elements.adminId.value);
    try {
      await apiRequest(`/api/superadmin/admins/${adminId}/permissions`, {
        method: 'PUT', body: JSON.stringify({ permissions })
      });
      showToast('Administrator permissions updated.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminServiceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const id = payload.id;
    delete payload.id;
    payload.isAvailable = payload.isAvailable === 'true';
    payload.isPublished = payload.isPublished === 'true';
    try {
      const result = await apiRequest(id ? `/api/admin/services/${id}` : '/api/admin/services', {
        method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload)
      });
      if (!id) {
        form.elements.id.value = result.id;
        document.getElementById('superadminServiceEditorHeading').textContent = 'Edit service';
        form.querySelector('[type="submit"]').textContent = 'Save changes';
      }
      await refreshSuperadminServices();
      showToast(id ? 'Service updated.' : 'Service created.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('addSuperadminService').addEventListener('click', () => {
    const form = document.getElementById('superadminServiceForm');
    form.reset();
    form.elements.id.value = '';
    document.getElementById('superadminServiceEditorHeading').textContent = 'Add a service';
    form.querySelector('[type="submit"]').textContent = 'Add service';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.name.focus();
  });
  document.getElementById('cancelSuperadminServiceEdit').addEventListener('click', () => {
    const form = document.getElementById('superadminServiceForm');
    form.reset();
    form.elements.id.value = '';
    document.getElementById('superadminServiceEditorHeading').textContent = 'Add a service';
    form.querySelector('[type="submit"]').textContent = 'Add service';
  });
  document.getElementById('superadminServiceImageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const serviceId = document.getElementById('superadminServiceForm').elements.id.value;
    const file = event.currentTarget.elements.image.files[0];
    if (!serviceId || !file) return showToast('Select an existing service and image first.');
    try {
      await uploadImage(`/api/admin/services/${serviceId}/image`, file);
      event.currentTarget.reset();
      await refreshSuperadminServices();
      showToast('Service image uploaded.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('refreshSuperadminRequests').addEventListener('click', () => refreshSuperadminRequests().catch((error) => showToast(error.message)));
  document.getElementById('superadminRequestStatus').addEventListener('change', () => refreshSuperadminRequests().catch((error) => showToast(error.message)));
  document.getElementById('superadminRequestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      status: form.elements.status.value,
      progress: Number(form.elements.progress.value),
      assignedTo: form.elements.assignedTo.value ? Number(form.elements.assignedTo.value) : null
    };
    try {
      await apiRequest(`/api/admin/requests/${encodeURIComponent(form.elements.id.value)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await refreshSuperadminRequests();
      await refreshSuperadminOverview();
      await openSuperadminRequest(state.currentSuperadminRequestId);
      showToast('Service request updated.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminRequestNoteForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = { body: form.elements.body.value, isInternal: form.elements.isInternal.value === 'true' };
    try {
      await apiRequest(`/api/admin/requests/${encodeURIComponent(state.currentSuperadminRequestId)}/notes`, {
        method: 'POST', body: JSON.stringify(payload)
      });
      form.reset();
      await openSuperadminRequest(state.currentSuperadminRequestId);
      showToast(payload.isInternal ? 'Internal note added.' : 'Client update sent.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminContentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const published = values.published === 'true';
    delete values.published;
    try {
      await apiRequest('/api/superadmin/content', {
        method: 'PUT', body: JSON.stringify({ content: values, published })
      });
      const result = await apiRequest('/api/superadmin/content');
      state.superadminContent = Object.fromEntries((result.content || []).map((item) => [item.key, item]));
      state.superadminContent.published = published;
      await loadPublicSiteContent();
      renderSuperadminContent();
      showToast('Website content saved.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminBrandImageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData();
    data.append('image', form.elements.image.files[0]);
    data.append('key', form.elements.key.value);
    try {
      const response = await fetchResponse('/api/superadmin/content/image', { method: 'POST', credentials: 'same-origin', body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Image upload failed.');
      form.reset();
      const content = await apiRequest('/api/superadmin/content');
      state.superadminContent = Object.fromEntries((content.content || []).map((item) => [item.key, item]));
      state.superadminContent.published = true;
      await loadPublicSiteContent();
      renderSuperadminContent();
      showToast('Website image uploaded and published.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      maintenanceMode: form.elements.maintenanceMode.value === 'true',
      passwordMinLength: Number(form.elements.passwordMinLength.value),
      sessionTimeoutMinutes: Number(form.elements.sessionTimeoutMinutes.value)
    };
    try {
      await apiRequest('/api/superadmin/settings', { method: 'PUT', body: JSON.stringify(payload) });
      state.superadminSettings = await apiRequest('/api/superadmin/settings');
      renderSuperadminSettings();
      await loadPublicSiteContent();
      showToast('System settings saved.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('refreshSuperadminAudit').addEventListener('click', () => refreshSuperadminAudit().catch((error) => showToast(error.message)));
  document.getElementById('refreshSuperadminNotifications').addEventListener('click', () => refreshSuperadminNotifications().catch((error) => showToast(error.message)));
  document.getElementById('superadminNotificationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.audience === 'user') payload.userId = Number(payload.userId);
    else delete payload.userId;
    try {
      const result = await apiRequest('/api/superadmin/notifications', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      await refreshSuperadminNotifications();
      showToast(`Notification sent to ${result.recipients} account${result.recipients === 1 ? '' : 's'}.`);
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('createSuperadminBackup').addEventListener('click', async () => {
    try {
      const result = await apiRequest('/api/superadmin/backups', { method: 'POST' });
      const backups = await apiRequest('/api/superadmin/backups');
      state.superadminBackups = backups.backups || [];
      renderSuperadminBackups();
      showToast(`Database backup created: ${result.filename}`);
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminRestoreForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!window.confirm('This replaces the live database. A safety backup will be created before restore. Continue?')) return;
    try {
      const result = await apiRequest(`/api/superadmin/backups/${Number(form.elements.backupId.value)}/restore`, {
        method: 'POST', body: JSON.stringify({ confirmation: form.elements.confirmation.value })
      });
      showToast(result.message);
      await loadPortalData();
      renderAll();
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.currentPassword) delete payload.currentPassword;
    if (!payload.newPassword) delete payload.newPassword;
    try {
      await apiRequest('/api/admin/profile', { method: 'PATCH', body: JSON.stringify(payload) });
      state.superadminProfile = await apiRequest('/api/admin/profile').then((result) => result.profile);
      state.user.fullName = payload.fullName;
      state.user.email = payload.email;
      state.user.phone = payload.phone;
      form.elements.currentPassword.value = '';
      form.elements.newPassword.value = '';
      renderSuperadminProfile();
      showToast('Super Admin profile updated.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminProfileImageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.image.files[0];
    if (!file) return;
    try {
      await uploadImage('/api/admin/profile/image', file);
      event.currentTarget.reset();
      state.superadminProfile = await apiRequest('/api/admin/profile').then((result) => result.profile);
      renderSuperadminProfile();
      showToast('Super Admin profile image uploaded.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('superadminPreferencesForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      emailEnabled: form.elements.emailEnabled.value === 'true',
      inAppEnabled: form.elements.inAppEnabled.value === 'true'
    };
    try {
      await apiRequest('/api/admin/preferences', { method: 'PUT', body: JSON.stringify(payload) });
      state.superadminPreferences = {
        emailEnabled: Number(payload.emailEnabled),
        inAppEnabled: Number(payload.inAppEnabled)
      };
      showToast('Super Admin notification preferences saved.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('refreshAdminOverview').addEventListener('click', () => refreshAdminOverview().catch((error) => showToast(error.message)));
  document.getElementById('refreshClients').addEventListener('click', () => refreshAdminClients().catch((error) => showToast(error.message)));
  document.getElementById('clientSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') refreshAdminClients().catch((error) => showToast(error.message));
  });
  document.getElementById('clientStatusFilter').addEventListener('change', () => refreshAdminClients().catch((error) => showToast(error.message)));
  document.getElementById('clientSort').addEventListener('change', () => refreshAdminClients().catch((error) => showToast(error.message)));
  document.getElementById('refreshAdminRequests').addEventListener('click', () => refreshAdminRequests().catch((error) => showToast(error.message)));
  document.getElementById('requestStatusFilter').addEventListener('change', () => refreshAdminRequests().catch((error) => showToast(error.message)));
  document.getElementById('newServiceButton').addEventListener('click', () => openServiceEditor());
  document.getElementById('closeClientEditor').addEventListener('click', () => { document.getElementById('clientEditor').hidden = true; });
  document.getElementById('closeServiceEditor').addEventListener('click', () => { document.getElementById('serviceEditor').hidden = true; });
  document.getElementById('closeRequestEditor').addEventListener('click', () => { document.getElementById('requestEditor').hidden = true; });

  document.getElementById('clientEditForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.isActive = payload.isActive === 'true';
    delete payload.id;
    try {
      await apiRequest(`/api/admin/clients/${state.currentClientId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await refreshAdminClients();
      await openAdminClient(state.currentClientId);
      showToast('Client profile updated.');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('serviceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const id = payload.id;
    delete payload.id;
    payload.isAvailable = payload.isAvailable === 'true';
    payload.isPublished = payload.isPublished === 'true';
    try {
      const result = await apiRequest(id ? `/api/admin/services/${id}` : '/api/admin/services', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      if (!id) {
        form.elements.id.value = result.id;
        const imageForm = document.getElementById('serviceImageForm');
        imageForm.elements.id.value = result.id;
        imageForm.hidden = false;
      }
      const services = await apiRequest('/api/admin/services');
      state.adminServices = services.services || [];
      renderAdminServices();
      showToast(id ? 'Service updated.' : 'Service created. You can now upload its image.');
      if (id) document.getElementById('serviceEditor').hidden = true;
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('serviceImageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.image.files[0];
    if (!file) return;
    try {
      await uploadImage(`/api/admin/services/${form.elements.id.value}/image`, file);
      const result = await apiRequest('/api/admin/services');
      state.adminServices = result.services || [];
      renderAdminServices();
      form.reset();
      showToast('Service image uploaded.');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('requestUpdateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      status: form.elements.status.value,
      progress: Number(form.elements.progress.value),
      assignedTo: form.elements.assignedTo.value ? Number(form.elements.assignedTo.value) : null
    };
    try {
      await apiRequest(`/api/admin/requests/${encodeURIComponent(form.elements.id.value)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await Promise.all([refreshAdminRequests(), refreshAdminOverview()]);
      await openAdminRequest(form.elements.id.value);
      showToast('Request updated and the client was notified if its status changed.');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('requestNoteForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = { body: form.elements.body.value, isInternal: form.elements.isInternal.value === 'true' };
    try {
      await apiRequest(`/api/admin/requests/${encodeURIComponent(state.currentRequestId)}/notes`, { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      await openAdminRequest(state.currentRequestId);
      showToast(payload.isInternal ? 'Internal note added.' : 'Client update sent.');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('adminNotificationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      title: form.elements.title.value.trim(),
      body: form.elements.body.value,
      announcement: form.elements.announcement.value === 'true'
    };
    if (!payload.announcement) payload.clientId = Number(form.elements.clientId.value);
    try {
      const result = await apiRequest('/api/admin/notifications', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      showToast(`Notification sent to ${result.recipients} client${result.recipients === 1 ? '' : 's'}.`);
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelectorAll('[data-report-format]').forEach((button) => {
    button.addEventListener('click', () => submitReport(button.dataset.reportFormat));
  });
  document.getElementById('adminProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await apiRequest('/api/admin/profile', { method: 'PATCH', body: JSON.stringify(payload) });
      state.user.fullName = payload.fullName;
      state.user.email = payload.email;
      state.user.phone = payload.phone;
      document.getElementById('profileName').textContent = payload.fullName;
      form.elements.currentPassword.value = '';
      form.elements.newPassword.value = '';
      showToast('Profile updated.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('adminProfileImageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.image.files[0];
    if (!file) return;
    try {
      const result = await uploadImage('/api/admin/profile/image', file);
      state.user.profileImage = result.image;
      state.adminProfile.profileImage = result.image;
      renderAdminProfile();
      form.reset();
      showToast('Profile picture uploaded.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('adminPreferencesForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      emailEnabled: form.elements.emailEnabled.value === 'true',
      inAppEnabled: form.elements.inAppEnabled.value === 'true'
    };
    try {
      await apiRequest('/api/admin/preferences', { method: 'PUT', body: JSON.stringify(payload) });
      state.adminPreferences = { emailEnabled: Number(payload.emailEnabled), inAppEnabled: Number(payload.inAppEnabled) };
      showToast('Notification preferences saved.');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelectorAll('[data-open-service-modal]').forEach((button) => {
    button.addEventListener('click', () => openModal(button.dataset.serviceName || ''));
  });
  document.addEventListener('click', (event) => {
    const serviceButton = event.target.closest('[data-service-name]');
    if (serviceButton) openModal(serviceButton.dataset.serviceName);
    const pageButton = event.target.closest('[data-open-page]');
    if (pageButton) setPage(pageButton.dataset.openPage);
    const requestButton = event.target.closest('[data-request-id]');
    if (requestButton) {
      const request = state.requests.find((item) => item.id === requestButton.dataset.requestId);
      if (request) renderRequestDetails(request);
    }
    const notificationButton = event.target.closest('[data-mark-notification]');
    if (notificationButton) markNotificationRead(notificationButton.dataset.markNotification);
    const chatContactButton = event.target.closest('[data-chat-contact-id]');
    if (chatContactButton) {
      setPage('messages');
      loadChatMessages(chatContactButton.dataset.chatContactId);
    }
    const clientButton = event.target.closest('[data-admin-client-id]');
    if (clientButton) openAdminClient(clientButton.dataset.adminClientId);
    const requestAdminButton = event.target.closest('[data-admin-request-id]');
    if (requestAdminButton) openAdminRequest(requestAdminButton.dataset.adminRequestId);
    const editServiceButton = event.target.closest('[data-admin-service-edit]');
    if (editServiceButton) openServiceEditor(state.adminServices.find((service) => service.id === Number(editServiceButton.dataset.adminServiceEdit)));
    const archiveServiceButton = event.target.closest('[data-admin-service-archive]');
    if (archiveServiceButton) {
      apiRequest(`/api/admin/services/${Number(archiveServiceButton.dataset.adminServiceArchive)}`, { method: 'DELETE' })
        .then(async () => {
          const result = await apiRequest('/api/admin/services');
          state.adminServices = result.services || [];
          renderAdminServices();
          showToast('Service archived.');
        }).catch((error) => showToast(error.message));
    }
    const readAdminNotification = event.target.closest('[data-admin-notification-read]');
    if (readAdminNotification) {
      apiRequest(`/api/admin/notifications/${Number(readAdminNotification.dataset.adminNotificationRead)}/read`, { method: 'PATCH' })
        .then(async () => {
          const result = await apiRequest('/api/admin/notifications');
          state.adminNotifications = result.notifications || [];
          renderAdmin();
        }).catch((error) => showToast(error.message));
    }
    const deleteAdminNotification = event.target.closest('[data-admin-notification-delete]');
    if (deleteAdminNotification) {
      apiRequest(`/api/admin/notifications/${Number(deleteAdminNotification.dataset.adminNotificationDelete)}`, { method: 'DELETE' })
        .then(async () => {
          const result = await apiRequest('/api/admin/notifications');
          state.adminNotifications = result.notifications || [];
          renderAdmin();
          showToast('Notification deleted.');
        }).catch((error) => showToast(error.message));
    }
    const superadminUser = event.target.closest('[data-open-superadmin-user]');
    if (superadminUser) openSuperadminUser(superadminUser.dataset.openSuperadminUser);
    const performanceButton = event.target.closest('[data-admin-performance]');
    if (performanceButton) {
      apiRequest(`/api/superadmin/admins/${Number(performanceButton.dataset.adminPerformance)}/performance`)
        .then((result) => {
          const user = state.superadminUsers.find((item) => item.id === result.performance.id);
          if (user) Object.assign(user, result.performance);
          renderSuperadminUsers();
        }).catch((error) => showToast(error.message));
    }
    const editSuperadminService = event.target.closest('[data-edit-superadmin-service]');
    if (editSuperadminService) {
      const service = state.superadminServices.find((item) => item.id === Number(editSuperadminService.dataset.editSuperadminService));
      const form = document.getElementById('superadminServiceForm');
      if (service) {
        form.reset();
        form.elements.id.value = service.id;
        form.elements.name.value = service.name;
        form.elements.category.value = service.category;
        form.elements.description.value = service.description;
        form.elements.price.value = service.price || '';
        form.elements.isAvailable.value = String(Boolean(service.isAvailable));
        form.elements.isPublished.value = String(Boolean(service.isPublished));
        document.getElementById('superadminServiceEditorHeading').textContent = 'Edit service';
        form.querySelector('[type="submit"]').textContent = 'Save changes';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    const archiveSuperadminService = event.target.closest('[data-archive-superadmin-service]');
    if (archiveSuperadminService && window.confirm('Remove this service from the client and Admin catalogs? Existing service request history will be preserved.')) {
      apiRequest(`/api/admin/services/${Number(archiveSuperadminService.dataset.archiveSuperadminService)}`, { method: 'DELETE' })
        .then(async () => {
          await refreshSuperadminServices();
          showToast('Service removed from the catalog. Existing request history was preserved.');
        }).catch((error) => showToast(error.message));
    }
    const openSuperadminRequestButton = event.target.closest('[data-open-superadmin-request]');
    if (openSuperadminRequestButton) openSuperadminRequest(openSuperadminRequestButton.dataset.openSuperadminRequest);
    const readSuperadminNotification = event.target.closest('[data-read-superadmin-notification]');
    if (readSuperadminNotification) {
      apiRequest(`/api/superadmin/notifications/${Number(readSuperadminNotification.dataset.readSuperadminNotification)}/read`, { method: 'PATCH' })
        .then(refreshSuperadminNotifications).catch((error) => showToast(error.message));
    }
    const downloadBackup = event.target.closest('[data-download-superadmin-backup]');
    if (downloadBackup) {
      fetchResponse(`/api/superadmin/backups/${Number(downloadBackup.dataset.downloadSuperadminBackup)}/download`, { credentials: 'same-origin' })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Unable to download the database backup.');
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `aj-backup-${downloadBackup.dataset.downloadSuperadminBackup}.sqlite`;
          document.body.append(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        }).catch((error) => showToast(error.message));
    }
  });
  document.getElementById('viewAllNotifications').addEventListener('click', () => {
    setPage('notifications');
    setNotificationDrawer(false);
  });
  document.getElementById('markAllNotificationsRead').addEventListener('click', markAllNotificationsRead);
  document.getElementById('markDrawerNotificationsRead').addEventListener('click', markAllNotificationsRead);
  document.getElementById('requestServiceHero').addEventListener('click', () => openModal());
  document.getElementById('browseServicesHero').addEventListener('click', () => setPage('catalog'));
  document.getElementById('requestSearch').addEventListener('input', renderRequests);
  document.getElementById('globalSearch').addEventListener('input', () => {
    if (location.hash !== '#catalog') setPage('catalog');
    renderServices();
  });
  document.querySelectorAll('.nav-link[data-page]').forEach((button) => {
    button.addEventListener('click', () => setPage(button.dataset.page));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setNotificationDrawer(false);
      closeModal();
      toggleSidebar(false);
    }
  });
  window.addEventListener('popstate', () => setPage(location.hash.slice(1), false));
  window.addEventListener('hashchange', () => setPage(location.hash.slice(1), false));
}

function initializePortal() {
  updateDate();
  renderAll();
  if (typeof io === 'function') {
    if (state.socket) state.socket.disconnect();
    state.socket = io();
    state.socket.on('chat:message', addChatMessage);
    state.socket.on('services:changed', async () => {
      try {
        if (state.user?.role === 'superadmin') {
          await refreshSuperadminServices();
        } else if (state.user?.role === 'admin' && state.adminPermissions.services !== false) {
          const result = await apiRequest('/api/admin/services');
          state.adminServices = result.services || [];
          renderAdminServices();
        } else if (state.user?.role === 'client') {
          const result = await apiRequest('/api/services');
          state.services = result.services || [];
          renderServices();
        }
      } catch (error) {
        showToast(error.message);
      }
    });
    state.socket.on('notification', (notification) => {
      if (notification.title === 'Admin account request' && state.user?.role === 'superadmin') {
        refreshSuperadminAccountRequests().catch((error) => showToast(error.message));
      }
      if (state.notifications.some((item) => item.id === notification.id)) return;
      state.notifications.unshift(notification);
      renderNotifications();
      showToast(notification.title);
    });
  }
  setPage(location.hash.slice(1), false);
  hideLoader();
}

async function bootstrap() {
  initializeEvents();
  try {
    applyTheme(localStorage.getItem('ajTheme') || 'dark');
  } catch (error) {
    console.warn('Theme preference could not be loaded:', error);
    applyTheme('dark');
  }
  let user;
  await loadPublicSiteContent();
  try {
    const result = await apiRequest('/api/me');
    user = result.user;
  } catch (error) {
    showAuthGate();
    if (error.message !== 'Please sign in to access your account.') setAuthError(error.message);
    return;
  }
  showPortal(user);
  try {
    await loadPortalData();
  } catch (error) {
    showToast(error.message);
  }
  initializePortal();
}

document.addEventListener('DOMContentLoaded', bootstrap);
