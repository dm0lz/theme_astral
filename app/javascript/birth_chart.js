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
  const karmicPoints = JSON.parse(canvas.dataset.karmicPoints || '[]');
  
  let time = 0;
  
  const resizeCanvas = () => {
    const padding = 100; // Add padding for labels
    const baseSize = Math.min(window.innerWidth * 0.8, 800);
    const size = baseSize + padding;
    canvas.width = size;
    canvas.height = size;
  };
  
  const drawChart = (timestamp) => {
    time = timestamp * 0.001;
    const padding = 100; // Match the padding from resizeCanvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = ((canvas.width - padding) * 0.8) / 2; // Adjust radius to account for padding
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw solid background for the center area
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#0A0A20'; // Tailwind's bg-gray-900
    ctx.fill();
    ctx.restore();

    // Draw zodiac wheel with elemental background colors
    const zodiacData = [
      { symbol: '♈', name: 'Aries', element: 'fire' },
      { symbol: '♉', name: 'Taurus', element: 'earth' },
      { symbol: '♊', name: 'Gemini', element: 'air' },
      { symbol: '♋', name: 'Cancer', element: 'water' },
      { symbol: '♌', name: 'Leo', element: 'fire' },
      { symbol: '♍', name: 'Virgo', element: 'earth' },
      { symbol: '♎', name: 'Libra', element: 'air' },
      { symbol: '♏', name: 'Scorpio', element: 'water' },
      { symbol: '♐', name: 'Sagittarius', element: 'fire' },
      { symbol: '♑', name: 'Capricorn', element: 'earth' },
      { symbol: '♒', name: 'Aquarius', element: 'air' },
      { symbol: '♓', name: 'Pisces', element: 'water' }
    ];

    // Elemental colors using traditional associations, optimized for dark theme
    const elementColors = {
      'fire': 'rgba(176, 23, 23, 0.8)', // Warmer red that harmonizes with the gold theme
      'earth': 'rgba(232, 225, 21, 0.8)', // Golden yellow matching existing house numbers
      'air': 'rgba(35, 205, 75, 0.8)', // Softer green that complements purple
      'water': 'rgba(28, 35, 227, 0.8)' // Purple-blue matching the main chart color
    };

    // Find the longitude of House 1 (Ascendant)
    const house1 = housePositions.find(h => h.house === 1);
    const house1Longitude = house1 ? house1.longitude : 0;

    // Draw zodiac wheel sectors with elemental colors
    zodiacData.forEach((zodiac, i) => {
      // Calculate the start and end angles for this zodiac sign (each is 30°)
      const signStart = i * 30;
      const signEnd = (i + 1) * 30;
      
      // Adjust for house 1 position and convert to canvas coordinates
      const adjustedStart = (signStart - house1Longitude + 360) % 360;
      const adjustedEnd = (signEnd - house1Longitude + 360) % 360;
      
      // Convert to canvas angles (0° = 3 o'clock, going clockwise)
      // We want 0° to be at 9 o'clock (left side), so subtract from 180°
      const startAngle = ((180 - adjustedStart) * Math.PI) / 180;
      const endAngle = ((180 - adjustedEnd) * Math.PI) / 180;
      
      // Draw thin colored line at outer edge
      const innerRadius = radius * 0.99; // Very thin line - just 3% of radius
      const outerRadius = radius; // At the wheel edge
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle, true);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, false);
      ctx.closePath();
      ctx.fillStyle = elementColors[zodiac.element];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
      
      // Draw zodiac symbol inside the outer wheel
      const symbolPosition = signStart + 15; // Middle of the 30° sector
      const adjustedSymbol = (symbolPosition - house1Longitude + 360) % 360;
      const symbolAngle = ((180 - adjustedSymbol) * Math.PI) / 180;
      const symbolRadius = radius * 0.88; // Position symbols further inside with more padding from outer wheel
      const x = centerX + Math.cos(symbolAngle) * symbolRadius;
      const y = centerY + Math.sin(symbolAngle) * symbolRadius;
      
      ctx.font = 'bold 36px serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zodiac.symbol, x, y);
    });

    // Draw the main outer chart circle (outer wheel)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw house delimiters outside the outer wheel
    housePositions.forEach((house, i) => {
      const adjustedLongitude = (house.longitude - house1Longitude + 360) % 360;
      const angle = ((180 - adjustedLongitude) * Math.PI) / 180;
      
      // Delimiter outside the wheel (keep this)
      const outerInnerRadius = radius; // Start at the outer wheel edge
      const outerOuterRadius = radius + 15; // Extend 15px outside the wheel
      const x1 = centerX + Math.cos(angle) * outerInnerRadius;
      const y1 = centerY + Math.sin(angle) * outerInnerRadius;
      const x2 = centerX + Math.cos(angle) * outerOuterRadius;
      const y2 = centerY + Math.sin(angle) * outerOuterRadius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#f3f4f6'; // text-gray-100
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Only 10px delimiter between zodiac area and house degrees text
      const zodiacEdge = radius * 0.97; // Edge of thin zodiac line
      const delimiterStart = zodiacEdge; // Start at zodiac edge
      const delimiterEnd = zodiacEdge - 15; // Only 10px inward
      const x3 = centerX + Math.cos(angle) * delimiterStart;
      const y3 = centerY + Math.sin(angle) * delimiterStart;
      const x4 = centerX + Math.cos(angle) * delimiterEnd;
      const y4 = centerY + Math.sin(angle) * delimiterEnd;
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.strokeStyle = '#f3f4f6'; // text-gray-100
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    // Draw zodiac sign delimiters inside the wheel
    for (let i = 0; i < 12; i++) {
      const signBoundary = i * 30;
      const adjustedBoundary = (signBoundary - house1Longitude + 360) % 360;
      const angle = ((180 - adjustedBoundary) * Math.PI) / 180;
      const outerRadius = radius;
      const innerRadius = radius - 18; // 18px inside the wheel
      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Helper for Roman numerals
    function toRoman(num) {
      const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
      return romans[num-1] || num;
    }
    
    // Draw houses (relative to House 1 at 0°, rotated)
    housePositions.forEach((house, i) => {
      const adjustedLongitude = (house.longitude - house1Longitude + 360) % 360;
      const angle = ((180 - adjustedLongitude) * Math.PI) / 180;
      const houseRadius = radius + 10; // extend 10px beyond the outer wheel
      const x = centerX + Math.cos(angle) * houseRadius;
      const y = centerY + Math.sin(angle) * houseRadius;
      // Draw house cusp line (extending 10px beyond outer wheel)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Draw Roman numeral with more padding from outer wheel
      const romanRadius = radius * 1.08; // Moved further out for more padding from outer wheel
      const rx = centerX + Math.cos(angle) * romanRadius;
      const ry = centerY + Math.sin(angle) * romanRadius;
      ctx.font = 'bold 14px serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(toRoman(house.house), rx, ry);
      // Draw house degree and sign with more padding from zodiac ring
      const degreeRadius = radius * 0.75; // Moved further inside for more padding from zodiac ring
      const dx = centerX + Math.cos(angle) * degreeRadius;
      const dy = centerY + Math.sin(angle) * degreeRadius;
      ctx.font = '10px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatPlanetDegree(house.longitude), dx, dy);
    });
    
    // Draw degree ticks and labels (rotated 90° counterclockwise)
    // for (let deg = 0; deg < 360; deg += 10) {
    //   const angle = ((360 - deg + 180) % 360) * Math.PI / 180;
    //   const outerRadius = radius;
    //   const innerRadius = deg % 30 === 0 ? radius * 0.97 : radius * 0.985;
    //   const x1 = centerX + Math.cos(angle) * outerRadius;
    //   const y1 = centerY + Math.sin(angle) * outerRadius;
    //   const x2 = centerX + Math.cos(angle) * innerRadius;
    //   const y2 = centerY + Math.sin(angle) * innerRadius;
    //   ctx.beginPath();
    //   ctx.moveTo(x1, y1);
    //   ctx.lineTo(x2, y2);
    //   ctx.strokeStyle = deg % 30 === 0 ? '#fff' : 'rgba(255,255,255,0.3)';
    //   ctx.lineWidth = deg % 30 === 0 ? 2 : 1;
    //   ctx.stroke();
    //   if (deg % 30 === 0) {
    //     const labelRadius = radius * 1.03;
    //     const lx = centerX + Math.cos(angle) * labelRadius;
    //     const ly = centerY + Math.sin(angle) * labelRadius;
    //     ctx.font = '11px sans-serif';
    //     ctx.fillStyle = '#fff';
    //     ctx.textAlign = 'center';
    //     ctx.textBaseline = 'middle';
    //     ctx.fillText(deg.toString(), lx, ly);
    //   }
    // }
    
    // Draw planets (outside the wheel, like the reference image)
    const planetSymbols = {
      'Sun': '☉',
      'Moon': '☽',
      'Mercury': '☿',
      'Venus': '♀',
      'Mars': '♂',
      'Jupiter': '♃',
      'Saturn': '♄',
      'Uranus': '♅',
      'Neptune': '♆',
      'Pluto': '♇'
    };

    // Karmic points symbols
    const karmicSymbols = {
      'NorthNode': '☊',  // Nœud Nord
      'SouthNode': '☋',  // Nœud Sud  
      'Chiron': '⚷',     // Chiron
      'Lilith': '⚸'      // Lilith (Lune Noire)
    };

    // Define planetary rulerships
    const planetRulerships = {
      'Sun': [4], // Leo (5th sign, index 4)
      'Moon': [3], // Cancer (4th sign, index 3)
      'Mercury': [2, 5], // Gemini (3rd sign, index 2) and Virgo (6th sign, index 5)
      'Venus': [1, 6], // Taurus (2nd sign, index 1) and Libra (7th sign, index 6)
      'Mars': [0, 7], // Aries (1st sign, index 0) and Scorpio (8th sign, index 7)
      'Jupiter': [8, 11], // Sagittarius (9th sign, index 8) and Pisces (12th sign, index 11)
      'Saturn': [9, 10], // Capricorn (10th sign, index 9) and Aquarius (11th sign, index 10)
      'Uranus': [10], // Aquarius (11th sign, index 10) - modern ruler
      'Neptune': [11], // Pisces (12th sign, index 11) - modern ruler
      'Pluto': [7] // Scorpio (8th sign, index 7) - modern ruler
    };

    // First pass: identify overlapping planets and assign padding levels
    const planetPadding = new Map();
    const processedGroups = new Set();
    
    planetPositions.forEach((planet1, i) => {
      if (planetPadding.has(planet1.planet)) return; // Already processed
      
      // Find all planets that overlap with this one
      const overlappingGroup = [planet1];
      planetPositions.forEach((planet2, j) => {
        if (i !== j) {
          const diff = Math.abs(planet1.longitude - planet2.longitude) % 360;
          const minDiff = Math.min(diff, 360 - diff);
          if (minDiff < 5) { // Consider planets within 5 degrees as overlapping
            overlappingGroup.push(planet2);
          }
        }
      });
      
      // Assign padding levels to each planet in the group
      overlappingGroup.forEach((planet, index) => {
        if (!planetPadding.has(planet.planet)) {
          // Only use special padding if there are actually overlapping planets
          if (overlappingGroup.length > 1) {
            // Assign padding: 32px for first, 64px for second, 96px for third, etc.
            const basePadding = 32;
            const padding = basePadding + (index * 32);
            planetPadding.set(planet.planet, padding);
          }
          // If no overlaps, the planet will use the default 64px padding (handled in the drawing phase)
        }
      });
    });

    // Second pass: draw planets with assigned padding
    planetPositions.forEach((planet, i) => {
      const adjustedLongitude = (planet.longitude - house1Longitude + 360) % 360;
      const angle = ((180 - adjustedLongitude) * Math.PI) / 180;
      
      // Use assigned padding or default if no overlaps
      const assignedPadding = planetPadding.get(planet.planet) || 64;
      
      const planetRadius = radius + assignedPadding;
      const x = centerX + Math.cos(angle) * planetRadius;
      const y = centerY + Math.sin(angle) * planetRadius;
      // Draw a line from the wheel edge to the planet symbol
      const edgeRadius = radius * 0.98;
      const ex = centerX + Math.cos(angle) * edgeRadius;
      const ey = centerY + Math.sin(angle) * edgeRadius;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Check if planet is in its own sign
      const planetSignIndex = Math.floor(planet.longitude / 30) % 12;
      const isInOwnSign = planetRulerships[planet.planet] && planetRulerships[planet.planet].includes(planetSignIndex);
      
      // Draw planet symbol (colored based on whether it's in its own sign)
      ctx.font = 'bold 72px serif';
      ctx.fillStyle = isInOwnSign ? 'rgba(251, 191, 36, 1)' : '#d1d5db'; // Sun color if in own sign, otherwise gray
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planetSymbols[planet.planet] || planet.planet[0], x, y);
      
      // Draw planet degree label below the symbol with reduced offset
      ctx.font = '13px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatPlanetDegree(planet.longitude, planet.retrograde), x, y + 28);
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
      const adjustedLongitude = (point.longitude - house1Longitude + 360) % 360;
      const angle = ((180 - adjustedLongitude) * Math.PI) / 180;
      const pointRadius = radius * 0.45;
      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pointSymbols[point.name] || point.name, x, y);
    });

    // Draw karmic points (lunar nodes, Chiron, Lilith) 
    karmicPoints.forEach((karmic, i) => {
      const adjustedLongitude = (karmic.longitude - house1Longitude + 360) % 360;
      const angle = ((180 - adjustedLongitude) * Math.PI) / 180;
      const karmicRadius = radius * 0.35; // Slightly inside chart points
      const x = centerX + Math.cos(angle) * karmicRadius;
      const y = centerY + Math.sin(angle) * karmicRadius;
      
      // Draw karmic point symbol
      ctx.font = 'bold 20px serif';
      ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'; // Golden color for karmic points
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(karmicSymbols[karmic.name] || karmic.name[0], x, y);
      
      // Draw karmic point degree label
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatKarmicDegree(karmic.longitude, karmic.retrograde), x, y + 12);
    });
    
    // Draw aspects between planets (relative to House 1 at 0°, rotated)
    planetPositions.forEach((planet1, i) => {
      planetPositions.forEach((planet2, j) => {
        if (j > i) {
          const adjustedLongitude1 = (planet1.longitude - house1Longitude + 360) % 360;
          const adjustedLongitude2 = (planet2.longitude - house1Longitude + 360) % 360;
          const angle1 = ((180 - adjustedLongitude1) * Math.PI) / 180;
          const angle2 = ((180 - adjustedLongitude2) * Math.PI) / 180;
          const radius1 = radius; // extend to outer wheel
          const radius2 = radius; // extend to outer wheel
          const x1 = centerX + Math.cos(angle1) * radius1;
          const y1 = centerY + Math.sin(angle1) * radius1;
          const x2 = centerX + Math.cos(angle2) * radius2;
          const y2 = centerY + Math.sin(angle2) * radius2;

          // Accurate minimal angular difference
          const rawDiff = Math.abs(planet1.longitude - planet2.longitude) % 360;
          const aspectAngle = rawDiff > 180 ? 360 - rawDiff : rawDiff;

          // All aspects
          const aspects = [
            { angle: 0, tolerance: 8, type: 'conjunction' },
            // { angle: 30, tolerance: 2, type: 'semi-sextile' },
            // { angle: 45, tolerance: 2, type: 'semi-square' },
            { angle: 60, tolerance: 6, type: 'sextile' },
            // { angle: 72, tolerance: 2, type: 'quintile' },
            { angle: 90, tolerance: 6, type: 'square' },
            { angle: 120, tolerance: 10, type: 'trine' },
            // { angle: 135, tolerance: 2, type: 'sesquiquadrate' },
            // { angle: 144, tolerance: 2, type: 'biquintile' },
            // { angle: 150, tolerance: 3, type: 'quincunx' },
            { angle: 180, tolerance: 8, type: 'opposition' }
          ];

          aspects.forEach(aspect => {
            if (Math.abs(aspectAngle - aspect.angle) <= aspect.tolerance) {
              // console.log(`Drawing ${aspect.type} (${aspectAngle}°) between ${planet1.planet} and ${planet2.planet}`); // Commented out to prevent flooding

              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);

              // Visual styling by aspect type
              switch (aspect.type) {
                case 'conjunction':
                  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
                  ctx.lineWidth = 1.5;
                  ctx.setLineDash([]);
                  break;
                case 'sextile':
                  ctx.strokeStyle = 'rgb(31, 55, 167)'; // solid red
                  ctx.lineWidth = 2;
                  ctx.setLineDash([]); // solid line
                  break;
                case 'trine':
                  ctx.strokeStyle = 'rgb(31, 55, 167)'; // solid red
                  ctx.lineWidth = 2;
                  ctx.setLineDash([]);
                  break;
                case 'square':
                  ctx.strokeStyle = 'rgb(156, 27, 27)'; // solid red
                  ctx.lineWidth = 2;
                  ctx.setLineDash([]); // solid line
                  break;
                case 'opposition':
                  ctx.strokeStyle = 'rgba(248, 113, 113, 0.4)';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([5, 5]);
                  break;
                case 'semi-sextile':
                case 'semi-square':
                case 'quintile':
                case 'sesquiquadrate':
                case 'biquintile':
                case 'quincunx':
                  ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)'; // soft gray
                  ctx.lineWidth = 0.8;
                  ctx.setLineDash([2, 4]);
                  break;
                default:
                  ctx.strokeStyle = 'gray';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([]);
              }

              ctx.stroke();
              ctx.setLineDash([]); // reset after each draw
            }
          });
        }
      });
    });
    
    // Remove the animation loop to prevent infinite redraw
    // requestAnimationFrame(drawChart);
  };
  
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
    drawChart(0);
  });
  drawChart(0);
}

function formatPlanetDegree(longitude, retrograde = false) {
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
  const retrogradeSymbol = retrograde ? '(R)' : '';
  return `${Math.floor(degInSign)}° ${signs[signIndex].abbr}${retrogradeSymbol}`;
}

function formatKarmicDegree(longitude, retrograde = false) {
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
  const retrogradeSymbol = retrograde ? '(R)' : '';
  return `${Math.floor(degInSign)}° ${signs[signIndex].abbr}${retrogradeSymbol}`;
} 