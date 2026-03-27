// ===== Navbar Scroll Effect =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// ===== Mobile Nav Toggle =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('active');
});

// Close nav on link click (mobile)
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// ===== Active Nav Link on Scroll =====
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 100;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (link) {
      link.classList.toggle('active', scrollY >= top && scrollY < top + height);
    }
  });
});

// ===== Fade-in on Scroll =====
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

// Add fade-in class to elements
document.querySelectorAll('.product-card, .about-card, .partner-type, .contact-item, .cta-card, .promo-banner, .products-note, .partnership-form-card, .section-header').forEach(el => {
  el.classList.add('fade-in');
  fadeObserver.observe(el);
});

// ===== Partner Form =====
const partnerForm = document.getElementById('partnerForm');
if (partnerForm) {
  partnerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('businessName').value;
    const location = document.getElementById('location').value;
    const type = document.getElementById('partnerType').value;
    const whatsapp = document.getElementById('whatsapp').value;
    
    // Build WhatsApp message
    const message = `Hi! I'd like to apply for partnership.\n\nBusiness: ${name}\nLocation: ${location}\nType: ${type}\nWhatsApp: ${whatsapp}`;
    
    const waUrl = `https://wa.me/60123456789?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    
    // Show success feedback
    const btn = partnerForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = '✓ Opening WhatsApp...';
    btn.style.background = '#6B8F5E';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 3000);
  });
}

// ===== Smooth stagger animation for product cards =====
document.querySelectorAll('.product-card').forEach((card, i) => {
  card.style.transitionDelay = `${i * 0.1}s`;
});
document.querySelectorAll('.about-card').forEach((card, i) => {
  card.style.transitionDelay = `${i * 0.1}s`;
});
document.querySelectorAll('.partner-type').forEach((item, i) => {
  item.style.transitionDelay = `${i * 0.08}s`;
});
