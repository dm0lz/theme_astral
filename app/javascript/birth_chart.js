// Initialize birth chart when Turbo loads the page
document.addEventListener('turbo:load', () => {
  initBirthChart();
});

function initBirthChart() {
  const canvas = document.getElementById('birthChartCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Get chart data from data attributes
  const planetPositions = JSON.parse(canvas.dataset.planetPositions || '[]');
  const housePositions = JSON.parse(canvas.dataset.housePositions || '[]');
  const chartPoints = JSON.parse(canvas.dataset.chartPoints || '[]');
  
  let time = 0;
  
  const resizeCanvas = () => {
    const size = Math.min(window.innerWidth * 0.8, 800);
    canvas.width = size;
    canvas.height = size;
  };
  
  const drawChart = (timestamp) => {
    time = timestamp * 0.001;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = (canvas.width * 0.8) / 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
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
      { symbol: '♈', name: 'Aries', color: '#FF6B6B' },
      { symbol: '♉', name: 'Taurus', color: '#4EA8DE' },
      { symbol: '♊', name: 'Gemini', color: '#FFD93D' },
      { symbol: '♋', name: 'Cancer', color: '#4EA8DE' },
      { symbol: '♌', name: 'Leo', color: '#FF6B6B' },
      { symbol: '♍', name: 'Virgo', color: '#4EA8DE' },
      { symbol: '♎', name: 'Libra', color: '#FFD93D' },
      { symbol: '♏', name: 'Scorpio', color: '#4EA8DE' },
      { symbol: '♐', name: 'Sagittarius', color: '#FF6B6B' },
      { symbol: '♑', name: 'Capricorn', color: '#4EA8DE' },
      { symbol: '♒', name: 'Aquarius', color: '#FFD93D' },
      { symbol: '♓', name: 'Pisces', color: '#4EA8DE' }
    ];

    // Draw zodiac wheel
    zodiacData.forEach((zodiac, i) => {
      // Aries (0°) at 9 o'clock, angles increase clockwise, fix 180° mismatch
      const zodiacLongitude = i * 30; // Each sign is 30°
      const angle = ((360 - zodiacLongitude + 270) % 360) * Math.PI / 180;
      const symbolRadius = radius * 0.925;
      const x = centerX + Math.cos(angle) * symbolRadius;
      const y = centerY + Math.sin(angle) * symbolRadius;
      
      // Draw zodiac sector
      const startAngle = ((360 - (zodiacLongitude - 15) + 270) % 360) * Math.PI / 180;
      const endAngle = ((360 - (zodiacLongitude + 15) + 270) % 360) * Math.PI / 180;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `rgba(139, 92, 246, 0.03)`;
      ctx.fill();
      
      // Draw zodiac symbol
      ctx.font = 'bold 24px serif';
      ctx.fillStyle = zodiac.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zodiac.symbol, x, y);
      
      // Draw zodiac name
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(zodiac.name, x, y + 20);
    });
    
    // Draw houses
    housePositions.forEach((house, i) => {
      // 0° at 9 o'clock, angles increase clockwise, fix 180° mismatch
      const angle = ((360 - house.longitude + 270) % 360) * Math.PI / 180;
      const houseRadius = radius * 0.75;
      const x = centerX + Math.cos(angle) * houseRadius;
      const y = centerY + Math.sin(angle) * houseRadius;
      
      // Draw house cusp line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw house number
      ctx.font = 'bold 16px serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(house.house.toString(), x, y);
    });
    
    // Draw planets
    const planetSymbols = {
      'Sun': '☉',
      'Moon': '☽',
      'Mercury': '☿',
      'Venus': '♀',
      'Mars': '♂',
      'Jupiter': '♃',
      'Saturn': '♄',
      'Uranus': '⛢',
      'Neptune': '♆',
      'Pluto': '♇'
    };
    
    const planetColors = {
      'Sun': 'rgba(251, 191, 36, 1)',
      'Moon': 'rgba(229, 231, 235, 1)',
      'Mercury': 'rgba(147, 197, 253, 1)',
      'Venus': 'rgba(251, 207, 232, 1)',
      'Mars': 'rgba(248, 113, 113, 1)',
      'Jupiter': 'rgba(147, 197, 253, 1)',
      'Saturn': 'rgba(209, 213, 219, 1)',
      'Uranus': 'rgba(167, 139, 250, 1)',
      'Neptune': 'rgba(147, 197, 253, 1)',
      'Pluto': 'rgba(167, 139, 250, 1)'
    };
    
    planetPositions.forEach((planet, i) => {
      // 0° at 9 o'clock, angles increase clockwise, fix 180° mismatch
      const angle = ((360 - planet.longitude + 270) % 360) * Math.PI / 180;
      const planetRadius = radius * 0.6;
      const x = centerX + Math.cos(angle) * planetRadius;
      const y = centerY + Math.sin(angle) * planetRadius;
      
      // Draw planet symbol
      ctx.font = 'bold 28px serif';
      ctx.fillStyle = planetColors[planet.planet] || 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planetSymbols[planet.planet] || planet.planet[0], x, y);
      
      // Draw planet name
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(planet.planet, x, y + 20);
    });
    
    // Draw chart points
    const pointSymbols = {
      'Ascendant': 'AS',
      'MC': 'MC',
      'Vertex': 'Vx',
      'ARMC': 'AR',
      'EquatAsc': 'EA',
      'CoAscWK': 'CW',
      'CoAscM': 'CM',
      'PolarAsc': 'PA'
    };
    
    chartPoints.forEach((point, i) => {
      // 0° at 9 o'clock, angles increase clockwise, fix 180° mismatch
      const angle = ((360 - point.longitude + 270) % 360) * Math.PI / 180;
      const pointRadius = radius * 0.45;
      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;
      
      // Draw point symbol
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pointSymbols[point.name] || point.name, x, y);
    });
    
    // Draw aspects between planets
    planetPositions.forEach((planet1, i) => {
      planetPositions.forEach((planet2, j) => {
        if (j > i) {
          // 0° at 9 o'clock, angles increase clockwise, fix 180° mismatch
          const angle1 = ((360 - planet1.longitude + 270) % 360) * Math.PI / 180;
          const angle2 = ((360 - planet2.longitude + 270) % 360) * Math.PI / 180;
          const radius1 = radius * 0.6;
          const radius2 = radius * 0.6;
          const x1 = centerX + Math.cos(angle1) * radius1;
          const y1 = centerY + Math.sin(angle1) * radius1;
          const x2 = centerX + Math.cos(angle2) * radius2;
          const y2 = centerY + Math.sin(angle2) * radius2;
          
          // Calculate aspect angle
          const angleDiff = Math.abs(planet1.longitude - planet2.longitude);
          const aspectAngle = angleDiff % 360;
          
          // Define major aspects
          const aspects = [
            { angle: 0, tolerance: 8, type: 'conjunction' },
            { angle: 60, tolerance: 8, type: 'sextile' },
            { angle: 90, tolerance: 8, type: 'square' },
            { angle: 120, tolerance: 8, type: 'trine' },
            { angle: 180, tolerance: 8, type: 'opposition' }
          ];
          
          aspects.forEach(aspect => {
            if (Math.abs(aspectAngle - aspect.angle) <= aspect.tolerance) {
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              
              // Style based on aspect type
              switch (aspect.type) {
                case 'conjunction':
                  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
                  ctx.lineWidth = 1.5;
                  break;
                case 'sextile':
                case 'trine':
                  ctx.strokeStyle = 'rgba(147, 197, 253, 0.4)';
                  ctx.lineWidth = 1;
                  break;
                case 'square':
                case 'opposition':
                  ctx.strokeStyle = 'rgba(248, 113, 113, 0.4)';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([5, 5]);
                  break;
              }
              
              ctx.stroke();
              ctx.setLineDash([]);
            }
          });
        }
      });
    });
    
    requestAnimationFrame(drawChart);
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(drawChart);
} 