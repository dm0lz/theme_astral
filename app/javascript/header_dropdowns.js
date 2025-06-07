// Header dropdown functionality
let headerDropdownInitialized = false;

function initHeaderDropdowns() {
  // Prevent multiple initializations
  if (headerDropdownInitialized) {
    return;
  }
  headerDropdownInitialized = true;

  // Use event delegation to handle dropdown clicks
  document.addEventListener('click', handleDropdownClick);
  
  // Handle escape key
  document.addEventListener('keydown', handleEscapeKey);
}

function handleDropdownClick(e) {
  const dropdownToggle = e.target.closest('[data-dropdown-toggle]');
  
  if (dropdownToggle) {
    e.preventDefault();
    e.stopPropagation();
    
    const dropdown = dropdownToggle.closest('[data-dropdown]');
    const menu = dropdown.querySelector('[data-dropdown-menu]');
    const arrow = dropdown.querySelector('[data-dropdown-arrow]');
    
    if (!menu || !arrow) return;
    
    // Close all other dropdowns first
    document.querySelectorAll('[data-dropdown]').forEach(otherDropdown => {
      if (otherDropdown !== dropdown) {
        const otherMenu = otherDropdown.querySelector('[data-dropdown-menu]');
        const otherArrow = otherDropdown.querySelector('[data-dropdown-arrow]');
        if (otherMenu && otherArrow) {
          otherMenu.classList.add('hidden');
          otherArrow.style.transform = 'rotate(0deg)';
        }
      }
    });
    
    // Toggle current dropdown
    const isOpen = !menu.classList.contains('hidden');
    if (isOpen) {
      menu.classList.add('hidden');
      arrow.style.transform = 'rotate(0deg)';
    } else {
      menu.classList.remove('hidden');
      arrow.style.transform = 'rotate(180deg)';
    }
    return;
  }
  
  // Close all dropdowns when clicking outside
  if (!e.target.closest('[data-dropdown]')) {
    closeAllDropdowns();
  }
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('[data-dropdown]').forEach(dropdown => {
    const menu = dropdown.querySelector('[data-dropdown-menu]');
    const arrow = dropdown.querySelector('[data-dropdown-arrow]');
    if (menu && arrow) {
      menu.classList.add('hidden');
      arrow.style.transform = 'rotate(0deg)';
    }
  });
}

// Initialize on DOM load and Turbo load
document.addEventListener('DOMContentLoaded', initHeaderDropdowns);
document.addEventListener('turbo:load', () => {
  // Close any open dropdowns when navigating
  closeAllDropdowns();
}); 