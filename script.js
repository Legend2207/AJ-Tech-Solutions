// Portal state and placeholder data for the client experience.
const state = {
  services: [],
  requests: [],
  notifications: [],
  payments: [],
  tickets: [],
  documents: []
};

const defaultServices = [
  { id: 1, name: 'Website Development', duration: '4-8 weeks', price: 'From ₦450,000', icon: 'bi-globe2', description: 'High-converting web experiences with premium design and performance optimization.' },
  { id: 2, name: 'Software Development', duration: '6-12 weeks', price: 'From ₦850,000', icon: 'bi-code-square', description: 'Custom business software tailored to your internal workflows and growth goals.' },
  { id: 3, name: 'Mobile App Development', duration: '6-10 weeks', price: 'From ₦1,200,000', icon: 'bi-phone', description: 'Modern mobile solutions for Android, iOS, or cross-platform experiences.' },
  { id: 4, name: 'Networking', duration: '2-5 days', price: 'From ₦180,000', icon: 'bi-router', description: 'Secure networking, cabling, and infrastructure upgrades for modern teams.' },
  { id: 5, name: 'CCTV Installation', duration: '1-3 days', price: 'From ₦120,000', icon: 'bi-camera-video', description: 'Reliable surveillance systems designed for offices, homes, and retail sites.' },
  { id: 6, name: 'Cloud Solutions', duration: '3-7 days', price: 'From ₦260,000', icon: 'bi-cloud', description: 'Scalable cloud migration and managed infrastructure for modern organizations.' },
  { id: 7, name: 'Cybersecurity', duration: '2-6 days', price: 'From ₦300,000', icon: 'bi-shield-lock', description: 'Protect your systems with risk reviews, endpoint defense, and compliance planning.' },
  { id: 8, name: 'Computer Maintenance', duration: '1-2 days', price: 'From ₦90,000', icon: 'bi-pc-display', description: 'Proactive maintenance, hardware support, and device optimization.' },
  { id: 9, name: 'IT Consulting', duration: '2-4 weeks', price: 'From ₦320,000', icon: 'bi-people', description: 'Strategic guidance for digital operations, systems, staffing, and transformation.' },
  { id: 10, name: 'Graphics Design', duration: '3-7 days', price: 'From ₦85,000', icon: 'bi-brush', description: 'Brand visuals, presentations, marketing collateral, and UI design assets.' },
  { id: 11, name: 'Digital Branding', duration: '4-10 days', price: 'From ₦150,000', icon: 'bi-palette', description: 'Create a memorable visual identity with positioning and brand systems.' },
  { id: 12, name: 'IT Training & Facilitation', duration: '2-5 days', price: 'From ₦140,000', icon: 'bi-mortarboard', description: 'Hands-on training for teams and leadership across core technology topics.' }
];

const defaultRequests = [
  { id: 'REQ-1001', service: 'Website Development', priority: 'High', status: 'In Progress', assignedStaff: 'Grace Okafor', created: '2026-07-12', expected: '2026-07-28', progress: 72, details: 'Design system and frontend build in progress.' },
  { id: 'REQ-1002', service: 'Cybersecurity', priority: 'Medium', status: 'Waiting for Client', assignedStaff: 'Musa Ibrahim', created: '2026-07-08', expected: '2026-07-22', progress: 46, details: 'Security review and policy updates pending client feedback.' },
  { id: 'REQ-1003', service: 'Cloud Solutions', priority: 'Low', status: 'Completed', assignedStaff: 'Ada Oke', created: '2026-06-30', expected: '2026-07-10', progress: 100, details: 'Deployment completed and handover delivered.' }
];

const defaultNotifications = [
  { id: 1, title: 'Invoice generated', body: 'Invoice #INV-2041 is ready for download.', time: '12 mins ago', kind: 'invoice' },
  { id: 2, title: 'Technician assigned', body: 'Grace Okafor has been assigned to your website project.', time: '1 hour ago', kind: 'service' },
  { id: 3, title: 'Service completed', body: 'Your cloud migration package is now complete.', time: '2 hours ago', kind: 'service' }
];

const defaultPayments = [
  { id: 'INV-2041', amount: '₦450,000', status: 'Outstanding', due: '2026-07-25' },
  { id: 'INV-1998', amount: '₦180,000', status: 'Paid', due: '2026-06-18' }
];

const defaultTickets = [
  { id: 'TKT-118', title: 'Billing clarification', status: 'Open', priority: 'Medium' },
  { id: 'TKT-119', title: 'Website hosting support', status: 'Pending', priority: 'High' }
];

const defaultDocuments = [
  { name: 'Service agreement.pdf', type: 'Contract' },
  { name: 'Invoice-2041.pdf', type: 'Invoice' },
  { name: 'Security report.pdf', type: 'Report' }
];

const refs = {
  loaderShell: document.getElementById('loaderShell'),
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

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem('ajPortalState'));
    if (stored) {
      state.services = stored.services || defaultServices;
      state.requests = stored.requests || defaultRequests;
      state.notifications = stored.notifications || defaultNotifications;
      state.payments = stored.payments || defaultPayments;
      state.tickets = stored.tickets || defaultTickets;
      state.documents = stored.documents || defaultDocuments;
    } else {
      state.services = defaultServices;
      state.requests = defaultRequests;
      state.notifications = defaultNotifications;
      state.payments = defaultPayments;
      state.tickets = defaultTickets;
      state.documents = defaultDocuments;
    }
  } catch (error) {
    state.services = defaultServices;
    state.requests = defaultRequests;
    state.notifications = defaultNotifications;
    state.payments = defaultPayments;
    state.tickets = defaultTickets;
    state.documents = defaultDocuments;
  }
}

function saveState() {
  localStorage.setItem('ajPortalState', JSON.stringify(state));
}

function toggleLoader(show) {
  refs.loaderShell.classList.toggle('hidden', !show);
}

function updateDate() {
  const date = new Date();
  refs.currentDate.textContent = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = theme === 'light' ? 'bi-moon' : 'bi-sun';
  refs.themeToggle.innerHTML = `<i class="bi ${icon}"></i>`;
  localStorage.setItem('ajTheme', theme);
}

function toggleSidebar(force) {
  const isOpen = typeof force === 'boolean' ? force : !refs.sidebar.classList.contains('open');
  refs.sidebar.classList.toggle('open', isOpen);
  refs.overlay.classList.toggle('open', isOpen);
}

function openModal() {
  refs.modalBackdrop.classList.add('open');
  refs.requestModal.classList.add('open');
  document.getElementById('serviceName').focus();
}

function closeModal() {
  refs.modalBackdrop.classList.remove('open');
  refs.requestModal.classList.remove('open');
  refs.requestForm.reset();
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove('show'), 3200);
}

function animateCounters() {
  document.querySelectorAll('.metric-value').forEach((item) => {
    const target = Number(item.dataset.target || 0);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 24));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        item.textContent = target.toString();
        clearInterval(timer);
      } else {
        item.textContent = current.toString();
      }
    }, 24);
  });
}

function renderNotifications() {
  const items = state.notifications.slice(0, 4);
  refs.dashboardNotifications.innerHTML = items.map((item) => `
    <li class="notification-item">
      <div class="avatar"><i class="bi bi-bell"></i></div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.body}</p>
        <p>${item.time}</p>
      </div>
    </li>
  `).join('');
  refs.drawerNotificationList.innerHTML = state.notifications.map((item) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-bell"></i></div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.body}</p>
        <p>${item.time}</p>
      </div>
    </div>
  `).join('');
  refs.notificationBadge.textContent = state.notifications.length;
}

function renderServices() {
  refs.servicesGrid.innerHTML = state.services.map((service) => `
    <article class="service-card">
      <div class="service-icon"><i class="bi ${service.icon}"></i></div>
      <h3>${service.name}</h3>
      <p>${service.description}</p>
      <div class="service-meta">
        <span>${service.duration}</span>
        <strong>${service.price}</strong>
      </div>
      <button class="btn btn-primary" type="button" data-service-name="${service.name}">Request Service</button>
    </article>
  `).join('');
}

function renderRequests() {
  const search = document.getElementById('requestSearch')?.value?.toLowerCase() || '';
  const filtered = state.requests.filter((request) => {
    return [request.id, request.service, request.status, request.assignedStaff].join(' ').toLowerCase().includes(search);
  });

  refs.requestsTableBody.innerHTML = filtered.map((request) => `
    <tr>
      <td>${request.id}</td>
      <td>${request.service}</td>
      <td>${request.priority}</td>
      <td><span class="badge ${request.status.toLowerCase().replace(/\s+/g, '-')}">${request.status}</span></td>
      <td>${request.assignedStaff}</td>
      <td>${request.created}</td>
      <td>${request.expected}</td>
      <td><button class="text-btn" data-request-id="${request.id}" type="button">View details</button></td>
    </tr>
  `).join('');

  const firstRequest = filtered[0] || state.requests[0];
  if (firstRequest) {
    refs.requestDetailsContent.innerHTML = `
      <div class="detail-card">
        <div class="detail-grid">
          <div><span>Service</span><strong>${firstRequest.service}</strong></div>
          <div><span>Assigned staff</span><strong>${firstRequest.assignedStaff}</strong></div>
          <div><span>Status</span><strong>${firstRequest.status}</strong></div>
          <div><span>Completion</span><strong>${firstRequest.progress}%</strong></div>
        </div>
        <div class="progress-bar"><i style="width:${firstRequest.progress}%"></i></div>
        <p>${firstRequest.details}</p>
        <div class="timeline">
          <div class="timeline-item"><span class="timeline-dot"></span><div><strong>Request submitted</strong><p>${firstRequest.created}</p></div></div>
          <div class="timeline-item"><span class="timeline-dot"></span><div><strong>Admin reviewed</strong><p>Ready for assignment</p></div></div>
          <div class="timeline-item"><span class="timeline-dot"></span><div><strong>Work in progress</strong><p>${firstRequest.assignedStaff} is actively delivering</p></div></div>
          <div class="timeline-item"><span class="timeline-dot"></span><div><strong>Testing and delivery</strong><p>Pending final handoff</p></div></div>
        </div>
      </div>
    `;
  }
}

function renderPayments() {
  refs.outstandingInvoices.innerHTML = state.payments.map((payment) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-receipt"></i></div>
      <div>
        <strong>${payment.id}</strong>
        <p>Amount: ${payment.amount}</p>
        <p>Status: ${payment.status}</p>
        <p>Due: ${payment.due}</p>
      </div>
    </div>
  `).join('');

  refs.paymentHistory.innerHTML = state.payments.map((payment) => `
    <div class="setting-row">
      <span>${payment.id}</span>
      <span class="chip ${payment.status === 'Paid' ? 'chip-success' : ''}">${payment.status}</span>
    </div>
  `).join('');
}

function renderTickets() {
  refs.ticketsList.innerHTML = state.tickets.map((ticket) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-ticket"></i></div>
      <div>
        <strong>${ticket.title}</strong>
        <p>${ticket.id}</p>
        <p>${ticket.priority} • ${ticket.status}</p>
      </div>
    </div>
  `).join('');
}

function renderDocuments() {
  const items = state.documents.map((doc) => `
    <div class="setting-row">
      <span>${doc.name}</span>
      <span class="chip">${doc.type}</span>
    </div>
  `).join('');
  refs.documentsList.innerHTML = items;
  refs.documentsArchive.innerHTML = items;
}

function renderNotificationCenter() {
  refs.notificationCenterList.innerHTML = state.notifications.map((item) => `
    <div class="notification-item">
      <div class="avatar"><i class="bi bi-bell"></i></div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.body}</p>
        <p>${item.time}</p>
      </div>
    </div>
  `).join('');
}

function renderActivityTimeline() {
  const timeline = document.getElementById('activityTimeline');
  if (timeline) {
    timeline.innerHTML = [
      { title: 'Service request submitted', text: 'Website development onboarding packet shared.' },
      { title: 'Technical review', text: 'Admin confirmed your selected package.' },
      { title: 'Technician assigned', text: 'Grace Okafor started work on your request.' },
      { title: 'Milestone delivered', text: 'Design audit and implementation plan published.' }
    ].map((item) => `
      <div class="timeline-item"><span class="timeline-dot"></span><div><strong>${item.title}</strong><p>${item.text}</p></div></div>
    `).join('');
  }
}

// Render all portal sections from the shared state.
function renderAll() {
  renderServices();
  renderRequests();
  renderNotifications();
  renderPayments();
  renderTickets();
  renderDocuments();
  renderNotificationCenter();
  renderActivityTimeline();
  animateCounters();
}

function openPage(page) {
  document.querySelectorAll('.page').forEach((section) => section.classList.toggle('active', section.id === `page-${page}`));
  document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
  const safePage = page || 'dashboard';
  history.pushState({}, '', `#${safePage}`);
}

function initializeChart() {
  const ctx = document.getElementById('progressChart');
  if (!ctx || typeof Chart === 'undefined') return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [{
        label: 'Service momentum',
        data: [18, 24, 33, 42, 58, 72, 86],
        borderColor: '#4c7dff',
        backgroundColor: 'rgba(76,125,255,0.16)',
        tension: 0.3,
        fill: true
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// Submit a service request and notify the client plus admin feed.
async function submitRequest(event) {
  event.preventDefault();
  const formData = new FormData(refs.requestForm);
  const payload = Object.fromEntries(formData.entries());
  payload.serviceName = refs.serviceName.value.trim();
  payload.clientName = payload.clientName || 'John Doe';
  payload.email = payload.email || 'john@bluepeaklabs.com';
  payload.phone = payload.phone || '+234 806 123 4567';
  payload.companyName = payload.companyName || 'BluePeak Labs';
  payload.description = payload.description || 'Portal request';
  payload.additionalNotes = payload.additionalNotes || 'No extra notes.';
  payload.documents = Array.from(formData.getAll('documents')).map((file) => file.name).join(', ') || 'No upload';

  try {
    const response = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.success) {
      const request = {
        id: result.request.id,
        service: payload.serviceName,
        priority: payload.priority,
        status: 'New',
        assignedStaff: 'Pending assignment',
        created: 'Just now',
        expected: payload.preferredStartDate || 'TBD',
        progress: 10,
        details: payload.description
      };
      state.requests.unshift(request);
      state.notifications.unshift({
        id: Date.now(),
        title: 'New service request',
        body: `${payload.clientName} requested ${payload.serviceName}.`,
        time: 'Just now',
        kind: 'service'
      });
      saveState();
      renderAll();
      closeModal();
      showToast('Your request has been submitted successfully.');
    } else {
      throw new Error(result.message || 'Unable to submit request');
    }
  } catch (error) {
    state.requests.unshift({
      id: `REQ-${Date.now().toString().slice(-4)}`,
      service: payload.serviceName,
      priority: payload.priority,
      status: 'New',
      assignedStaff: 'Pending assignment',
      created: 'Just now',
      expected: payload.preferredStartDate || 'TBD',
      progress: 10,
      details: payload.description
    });
    state.notifications.unshift({
      id: Date.now(),
      title: 'New service request',
      body: `${payload.clientName} requested ${payload.serviceName}.`,
      time: 'Just now',
      kind: 'service'
    });
    saveState();
    renderAll();
    closeModal();
    showToast(error.message || 'Request saved locally and will sync when the server is available.');
  }
}

// Wire up interactions for navigation, theming, and request submission.
function initializeEvents() {
  refs.themeToggle.addEventListener('click', () => applyTheme(localStorage.getItem('ajTheme') === 'light' ? 'dark' : 'light'));
  refs.sidebarToggle.addEventListener('click', () => toggleSidebar());
  refs.mobileToggle.addEventListener('click', () => toggleSidebar(true));
  refs.overlay.addEventListener('click', () => toggleSidebar(false));
  refs.notificationsToggle.addEventListener('click', () => refs.notificationDrawer.classList.toggle('open'));
  refs.closeNotifications.addEventListener('click', () => refs.notificationDrawer.classList.remove('open'));
  refs.closeModal.addEventListener('click', closeModal);
  refs.cancelModal.addEventListener('click', closeModal);
  refs.modalBackdrop.addEventListener('click', closeModal);
  refs.requestForm.addEventListener('submit', submitRequest);
  document.querySelectorAll('[data-open-service-modal]').forEach((button) => button.addEventListener('click', openModal));
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-service-name]');
    if (!button) return;
    refs.serviceName.value = button.dataset.serviceName;
    openModal();
  });
  document.getElementById('viewAllNotifications').addEventListener('click', () => {
    openPage('notifications');
    refs.notificationDrawer.classList.remove('open');
  });
  document.getElementById('downloadInvoiceHero').addEventListener('click', () => showToast('Invoice download will be ready soon.'));
  document.getElementById('requestServiceHero').addEventListener('click', openModal);
  document.getElementById('requestSearch').addEventListener('input', renderRequests);
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.addEventListener('click', () => openPage(button.dataset.page));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      refs.notificationDrawer.classList.remove('open');
      closeModal();
      toggleSidebar(false);
    }
  });

  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '') || 'dashboard';
    openPage(page);
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-request-id]');
    if (target) {
      const request = state.requests.find((item) => item.id === target.dataset.requestId);
      if (request) {
        refs.requestDetailsContent.innerHTML = `
          <div class="detail-card">
            <div class="detail-grid">
              <div><span>Request ID</span><strong>${request.id}</strong></div>
              <div><span>Priority</span><strong>${request.priority}</strong></div>
              <div><span>Status</span><strong>${request.status}</strong></div>
              <div><span>Assigned staff</span><strong>${request.assignedStaff}</strong></div>
            </div>
            <p>${request.details}</p>
            <div class="progress-bar"><i style="width:${request.progress}%"></i></div>
          </div>
        `;
        showToast(`Viewing ${request.id}`);
      }
    }
  });
}

function bootstrap() {
  loadState();
  updateDate();
  const savedTheme = localStorage.getItem('ajTheme') || 'dark';
  applyTheme(savedTheme);
  initializeEvents();
  renderAll();
  initializeChart();
  setTimeout(() => {
    toggleLoader(false);
    const page = location.hash.replace('#', '') || 'dashboard';
    openPage(page);
  }, 650);
}

document.addEventListener('DOMContentLoaded', bootstrap);
