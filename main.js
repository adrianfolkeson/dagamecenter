// Animate stats counter on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible')
    }
  })
}, { threshold: 0.2 })

document.querySelectorAll('.stat-box, .game-card').forEach(el => observer.observe(el))

// Smooth card entrance
document.querySelectorAll('.game-card').forEach((card, i) => {
  card.style.opacity = '0'
  card.style.transform = 'translateY(20px)'
  card.style.transition = `opacity 0.4s ease ${i * 0.1}s, transform 0.4s ease ${i * 0.1}s`
})

const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1'
      entry.target.style.transform = 'translateY(0)'
    }
  })
}, { threshold: 0.1 })

document.querySelectorAll('.game-card').forEach(card => cardObserver.observe(card))
