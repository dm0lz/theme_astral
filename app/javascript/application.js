// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./channels"
import "./controllers"
import "./header_dropdowns"
import "./voice_recorder"
import "./landing"
import "./birth_chart"
import "./transits_chart"
import "./synastries_chart"
import "./solar_revolutions_chart"

import "trix"
import "@rails/actiontext"

// Mobile Menu Functionality
document.addEventListener('turbo:load', () => {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const hamburgerIcon = document.getElementById('hamburger-icon');
  const closeIcon = document.getElementById('close-icon');
  
  // Mobile Birth Chart submenu
  const mobileDropdownToggle = document.getElementById('mobile-birth-chart-toggle');
  const mobileDropdownMenu = document.getElementById('mobile-birth-chart-menu');
  const mobileDropdownArrow = document.getElementById('mobile-dropdown-arrow');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      
      if (isHidden) {
        // Show menu
        mobileMenu.classList.remove('hidden');
        hamburgerIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
      } else {
        // Hide menu
        mobileMenu.classList.add('hidden');
        hamburgerIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
        
        // Also close birth chart submenu if open
        if (mobileDropdownMenu && !mobileDropdownMenu.classList.contains('hidden')) {
          mobileDropdownMenu.classList.add('hidden');
          mobileDropdownArrow.style.transform = 'rotate(0deg)';
        }
      }
    });
  }

  // Mobile Birth Chart submenu toggle
  if (mobileDropdownToggle && mobileDropdownMenu) {
    mobileDropdownToggle.addEventListener('click', () => {
      const isHidden = mobileDropdownMenu.classList.contains('hidden');
      
      if (isHidden) {
        mobileDropdownMenu.classList.remove('hidden');
        mobileDropdownArrow.style.transform = 'rotate(180deg)';
      } else {
        mobileDropdownMenu.classList.add('hidden');
        mobileDropdownArrow.style.transform = 'rotate(0deg)';
      }
    });
  }

  // Close mobile menu when clicking on links
  const mobileLinks = mobileMenu?.querySelectorAll('a');
  mobileLinks?.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      hamburgerIcon.classList.remove('hidden');
      closeIcon.classList.add('hidden');
    });
  });

  // Close mobile menu on window resize if screen becomes large
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) { // lg breakpoint
      mobileMenu?.classList.add('hidden');
      hamburgerIcon?.classList.remove('hidden');
      closeIcon?.classList.add('hidden');
      
      // Reset birth chart submenu
      if (mobileDropdownMenu && !mobileDropdownMenu.classList.contains('hidden')) {
        mobileDropdownMenu.classList.add('hidden');
        mobileDropdownArrow.style.transform = 'rotate(0deg)';
      }
    }
  });
});
