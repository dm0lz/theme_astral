// Initialize everything when Turbo loads the page
document.addEventListener('turbo:load', () => {
    initStarBackground();
    initBirthChart();
    initTestimonialsSlider();
  });

  // Star Background Animation
  function initStarBackground() {
    const canvas = document.getElementById('starBackground');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const stars = [];
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };
    
    const initStars = () => {
      stars.length = 0;
      const starCount = Math.floor((canvas.width * canvas.height) / 6000);
      
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.6 + 0.1,
          pulse: Math.random() * 0.1 + 0.1,
          pulseDelta: (Math.random() - 0.5) * 0.01
        });
      }
    };
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * star.pulse})`;
        ctx.fill();
        
        star.pulse += star.pulseDelta;
        if (star.pulse >= 1 || star.pulse <= 0.1) {
          star.pulseDelta = -star.pulseDelta;
        }
      });
      
      requestAnimationFrame(animate);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animate();
  }

  // Birth Chart Animation
  function initBirthChart() {
    const canvas = document.getElementById('birthChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let time = 0;
    
    const resizeCanvas = () => {
      const size = Math.min(window.innerWidth * 0.8, 600);
      canvas.width = size;
      canvas.height = size;
    };
    
    const toRoman = (num) => {
      const romanNumerals = [
        ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
      ];
      
      let result = '';
      let remaining = num;
      
      for (const [numeral, value] of romanNumerals) {
        while (remaining >= value) {
          result += numeral;
          remaining -= value;
        }
      }
      
      return result;
    };
    
    const drawChart = (timestamp) => {
      time = timestamp * 0.001;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = (canvas.width * 0.8) / 2;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw house sectors
      for (let i = 0; i < 12; i++) {
        const startAngle = (i * Math.PI * 2) / 12 + time * 0.05;
        const endAngle = ((i + 1) * Math.PI * 2) / 12 + time * 0.05;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = `rgba(139, 92, 246, ${0.03 + Math.sin(time + i) * 0.01})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineTo(centerX, centerY);
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        const midAngle = (startAngle + endAngle) / 2;
        const textRadius = radius * 0.75;
        const x = centerX + Math.cos(midAngle) * textRadius;
        const y = centerY + Math.sin(midAngle) * textRadius;
        
        ctx.font = 'bold 20px serif';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(toRoman(i + 1), x, y);
      }
      
      // Draw chart circles
      const circles = [1, 0.85, 0.7, 0.55];
      circles.forEach((scale, index) => {
        const pulseScale = scale + Math.sin(time + index) * 0.005;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 + index * 0.1})`;
        ctx.lineWidth = index === 0 ? 2 : 1;
        ctx.stroke();
      });
      
      // Draw zodiac symbols
      const zodiacData = [
        { symbol: '♈', color: '#FF6B6B' }, // Aries
        { symbol: '♉', color: '#4EA8DE' }, // Taurus
        { symbol: '♊', color: '#FFD93D' }, // Gemini
        { symbol: '♋', color: '#4EA8DE' }, // Cancer
        { symbol: '♌', color: '#FF6B6B' }, // Leo
        { symbol: '♍', color: '#4EA8DE' }, // Virgo
        { symbol: '♎', color: '#FFD93D' }, // Libra
        { symbol: '♏', color: '#4EA8DE' }, // Scorpio
        { symbol: '♐', color: '#FF6B6B' }, // Sagittarius
        { symbol: '♑', color: '#4EA8DE' }, // Capricorn
        { symbol: '♒', color: '#FFD93D' }, // Aquarius
        { symbol: '♓', color: '#4EA8DE' }  // Pisces
      ];

      zodiacData.forEach((zodiac, i) => {
        const angle = ((i * Math.PI * 2) / 12) - Math.PI / 12 + time * 0.05;
        const symbolRadius = radius * (0.925 + Math.sin(time * 2 + i) * 0.005);
        const x = centerX + Math.cos(angle) * symbolRadius;
        const y = centerY + Math.sin(angle) * symbolRadius;
        
        ctx.font = `bold ${24 + Math.sin(time * 2 + i) * 2}px serif`;
        ctx.fillStyle = zodiac.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(time + i) * 0.05);
        ctx.fillText(zodiac.symbol, 0, 0);
        ctx.restore();
      });
      
      // Add planetary positions
      const planets = [
        { symbol: '☉', name: 'Sun', color: 'rgba(251, 191, 36, 1)', baseAngle: Math.PI * 0.2 },
        { symbol: '☽', name: 'Moon', color: 'rgba(229, 231, 235, 1)', baseAngle: Math.PI * 0.5 },
        { symbol: '☿', name: 'Mercury', color: 'rgba(147, 197, 253, 1)', baseAngle: Math.PI * 0.8 },
        { symbol: '♀', name: 'Venus', color: 'rgba(251, 207, 232, 1)', baseAngle: Math.PI * 1.1 },
        { symbol: '♂', name: 'Mars', color: 'rgba(248, 113, 113, 1)', baseAngle: Math.PI * 1.4 },
        { symbol: '♃', name: 'Jupiter', color: 'rgba(147, 197, 253, 1)', baseAngle: Math.PI * 1.7 },
        { symbol: '♄', name: 'Saturn', color: 'rgba(209, 213, 219, 1)', baseAngle: Math.PI * 0.3 },
        { symbol: '⛢', name: 'Uranus', color: 'rgba(167, 139, 250, 1)', baseAngle: Math.PI * 0.6 },
        { symbol: '♆', name: 'Neptune', color: 'rgba(147, 197, 253, 1)', baseAngle: Math.PI * 0.9 },
        { symbol: '♇', name: 'Pluto', color: 'rgba(167, 139, 250, 1)', baseAngle: Math.PI * 1.2 }
      ];
      
      planets.forEach((planet, i) => {
        const planetAngle = planet.baseAngle + time * (0.1 + i * 0.02);
        const planetRadius = radius * (0.6 + Math.sin(time + i) * 0.02);
        const x = centerX + Math.cos(planetAngle) * planetRadius;
        const y = centerY + Math.sin(planetAngle) * planetRadius;
        
        // Draw aspects between planets
        planets.forEach((otherPlanet, j) => {
          if (j > i) {
            const otherAngle = otherPlanet.baseAngle + time * (0.1 + j * 0.02);
            const otherRadius = radius * (0.6 + Math.sin(time + j) * 0.02);
            const otherX = centerX + Math.cos(otherAngle) * otherRadius;
            const otherY = centerY + Math.sin(otherAngle) * otherRadius;
            
            // Calculate aspect angle
            const angleDiff = Math.abs(planetAngle - otherAngle);
            const aspectAngle = (angleDiff * 180 / Math.PI) % 360;
            
            // Define major aspects (conjunction, sextile, square, trine, opposition)
            const aspects = [0, 60, 90, 120, 180];
            const tolerance = 8; // Degree tolerance for aspects
            
            aspects.forEach(aspect => {
              if (Math.abs(aspectAngle - aspect) <= tolerance) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(otherX, otherY);
                
                // Style based on aspect type
                if (aspect === 0) { // Conjunction
                  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
                  ctx.lineWidth = 1.5;
                } else if (aspect === 60 || aspect === 120) { // Harmonious aspects
                  ctx.strokeStyle = 'rgba(147, 197, 253, 0.4)';
                  ctx.lineWidth = 1;
                } else { // Challenging aspects
                  ctx.strokeStyle = 'rgba(248, 113, 113, 0.4)';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([5, 5]);
                }
                
                ctx.stroke();
                ctx.setLineDash([]); // Reset dash pattern
              }
            });
          }
        });
        
        // Draw planet symbol
        ctx.font = 'bold 28px serif';
        ctx.fillStyle = planet.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(planet.symbol, x, y);
      });
      
      requestAnimationFrame(drawChart);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(drawChart);
  }

  // Testimonials Slider
  function initTestimonialsSlider() {
    const container = document.getElementById('testimonials-container');
    const prevButton = document.getElementById('prev-testimonial');
    const nextButton = document.getElementById('next-testimonial');
    const dots = document.querySelectorAll('#testimonials-dots button');
    
    if (!container || !prevButton || !nextButton) return;
    
    let currentIndex = 0;
    const testimonials = container.children;
    const totalTestimonials = testimonials.length;
    
    const updateSlider = () => {
      // Update container position
      container.style.transform = `translateX(-${currentIndex * 100}%)`;
      
      // Update dots
      dots.forEach((dot, index) => {
        dot.classList.toggle('bg-amber-400', index === currentIndex);
        dot.classList.toggle('bg-purple-300/30', index !== currentIndex);
      });
    };
    
    const goToSlide = (index) => {
      currentIndex = (index + totalTestimonials) % totalTestimonials;
      updateSlider();
    };
    
    // Event listeners
    prevButton.addEventListener('click', () => goToSlide(currentIndex - 1));
    nextButton.addEventListener('click', () => goToSlide(currentIndex + 1));
    
    // Add click handlers to dots
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => goToSlide(index));
    });
    
    // Auto-advance slides every 5 seconds
    let autoSlideInterval = setInterval(() => goToSlide(currentIndex + 1), 5000);
    
    // Pause auto-advance on hover
    container.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
    container.addEventListener('mouseleave', () => {
      autoSlideInterval = setInterval(() => goToSlide(currentIndex + 1), 5000);
    });
    
    // Initialize first slide
    updateSlider();
  }