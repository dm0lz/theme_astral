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
    // Draw solid background for the wheel (bg-gray-900)
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#111827'; // Tailwind's bg-gray-900
    ctx.fill();
    ctx.restore();
    
    // Draw zodiac wheel
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

    // Find the longitude of House 1 (Ascendant)
    const house1 = housePositions.find(h => h.house === 1);
    const house1Longitude = house1 ? house1.longitude : 0;
    // Rotation offset: 90° counterclockwise
    const rotationOffset = -90;

    // Draw zodiac wheel (rotated and shifted relative to House 1)
    zodiacData.forEach((zodiac, i) => {
      // Each sign sector: 30° wide, starting at i*30°, shifted by house1Longitude
      const shiftedStart = (i * 30 - house1Longitude + 360) % 360;
      const shiftedEnd = ((i + 1) * 30 - house1Longitude + 360) % 360;
      const startAngle = ((360 - shiftedStart + 270 + rotationOffset) % 360) * Math.PI / 180;
      const endAngle = ((360 - shiftedEnd + 270 + rotationOffset) % 360) * Math.PI / 180;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // Symbol in the center of the sector
      const shiftedSymbol = (i * 30 + 15 - house1Longitude + 360) % 360;
      const symbolAngle = ((360 - shiftedSymbol + 270 + rotationOffset) % 360) * Math.PI / 180;
      const symbolRadius = radius * 0.925;
      const x = centerX + Math.cos(symbolAngle) * symbolRadius;
      const y = centerY + Math.sin(symbolAngle) * symbolRadius;
      ctx.font = 'bold 24px serif';
      ctx.fillStyle = zodiac.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zodiac.symbol, x, y);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(zodiac.name, x, y + 20);
    });
    
    // Draw chart circles (after sectors, so they're visible)
    const circles = [1, 0.85, 0.7, 0.55];
    circles.forEach((scale, index) => {
      const pulseScale = scale + Math.sin(time + index) * 0.005;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * pulseScale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.25 + index * 0.1})`;
      ctx.lineWidth = index === 0 ? 2 : 1;
      ctx.stroke();
    });
    
    // Draw houses (relative to House 1 at 0°, rotated)
    housePositions.forEach((house, i) => {
      const shifted = (house.longitude - house1Longitude + 360) % 360;
      const angle = ((360 - shifted + 270 + rotationOffset) % 360) * Math.PI / 180;
      const houseRadius = radius * 0.75;
      const x = centerX + Math.cos(angle) * houseRadius;
      const y = centerY + Math.sin(angle) * houseRadius;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = 'bold 16px serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(house.house.toString(), x, y);
    });
    
    // Draw degree ticks and labels (rotated)
    for (let deg = 0; deg < 360; deg += 10) {
      const angle = ((360 - deg + 180 + rotationOffset) % 360) * Math.PI / 180;
      const outerRadius = radius;
      const innerRadius = deg % 30 === 0 ? radius * 0.97 : radius * 0.985;
      const x1 = centerX + Math.cos(angle) * outerRadius;
      const y1 = centerY + Math.sin(angle) * outerRadius;
      const x2 = centerX + Math.cos(angle) * innerRadius;
      const y2 = centerY + Math.sin(angle) * innerRadius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = deg % 30 === 0 ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = deg % 30 === 0 ? 2 : 1;
      ctx.stroke();
      if (deg % 30 === 0) {
        const labelRadius = radius * 1.03;
        const lx = centerX + Math.cos(angle) * labelRadius;
        const ly = centerY + Math.sin(angle) * labelRadius;
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(deg.toString(), lx, ly);
      }
    }
    
    // Draw planets (relative to House 1 at 0°, rotated)
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
      const shifted = (planet.longitude - house1Longitude + 360) % 360;
      const angle = ((360 - shifted + 270 + rotationOffset) % 360) * Math.PI / 180;
      const planetRadius = radius * 0.6;
      const x = centerX + Math.cos(angle) * planetRadius;
      const y = centerY + Math.sin(angle) * planetRadius;
      ctx.font = 'bold 28px serif';
      ctx.fillStyle = planetColors[planet.planet] || 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planetSymbols[planet.planet] || planet.planet[0], x, y);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(planet.planet, x, y + 20);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(formatPlanetDegree(planet.longitude), x, y - 22);
    });
    
    // Draw chart points (relative to House 1 at 0°, rotated)
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
      const shifted = (point.longitude - house1Longitude + 360) % 360;
      const angle = ((360 - shifted + 270 + rotationOffset) % 360) * Math.PI / 180;
      const pointRadius = radius * 0.45;
      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pointSymbols[point.name] || point.name, x, y);
    });
    
    // Draw aspects between planets (relative to House 1 at 0°, rotated)
    planetPositions.forEach((planet1, i) => {
      planetPositions.forEach((planet2, j) => {
        if (j > i) {
          const shifted1 = (planet1.longitude - house1Longitude + 360) % 360;
          const shifted2 = (planet2.longitude - house1Longitude + 360) % 360;
          const angle1 = ((360 - shifted1 + 270 + rotationOffset) % 360) * Math.PI / 180;
          const angle2 = ((360 - shifted2 + 270 + rotationOffset) % 360) * Math.PI / 180;
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

function formatPlanetDegree(longitude) {
  const signs = [
    { name: 'Aries', abbr: 'Ar' },
    { name: 'Taurus', abbr: 'Ta' },
    { name: 'Gemini', abbr: 'Ge' },
    { name: 'Cancer', abbr: 'Cn' },
    { name: 'Leo', abbr: 'Le' },
    { name: 'Virgo', abbr: 'Vi' },
    { name: 'Libra', abbr: 'Li' },
    { name: 'Scorpio', abbr: 'Sc' },
    { name: 'Sagittarius', abbr: 'Sa' },
    { name: 'Capricorn', abbr: 'Cp' },
    { name: 'Aquarius', abbr: 'Aq' },
    { name: 'Pisces', abbr: 'Pi' }
  ];
  const signIndex = Math.floor(longitude / 30) % 12;
  const degInSign = longitude - signIndex * 30;
  return `${Math.floor(degInSign)}° ${signs[signIndex].abbr}`;
} 