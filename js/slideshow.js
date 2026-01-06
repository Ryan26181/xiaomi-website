// Infinite left-to-right slider for all hero sections
function initInfiniteSlider(selector) {
  const sections = Array.from(document.querySelectorAll(selector));
  sections.forEach((section) => {
    const slider = section.querySelector(".slider");
    if (!slider) return;

    const slides = Array.from(slider.children);
    if (slides.length === 0) return;

    const firstClone = slides[0].cloneNode(true);
    slider.appendChild(firstClone);

    let index = 0;
    const originalCount = slides.length;
    const slideCountWithClone = slider.children.length; // original + 1 clone
    const autoDurationMs = 2000; // auto transition duration
    const manualDurationMs = 800; // manual nav click duration (faster)
    const transitionEasing = "cubic-bezier(0.4, 0, 0.2, 1)";
    const intervalMs = 5000; // auto-slide interval

    // Apply initial position
    slider.style.transform = "translateX(0)";
    function setTransition(ms) {
      slider.style.transition = `transform ${ms / 1000}s ${transitionEasing}`;
    }
    setTransition(autoDurationMs);

    // Progress indicator via requestAnimationFrame
    const progressFills = Array.from(
      section.querySelectorAll(".progress-segment .progress-fill")
    );
    let activeSegIndex = 0;
    let progressStart = performance.now();
    let rafId = null;

    function setProgressWidths(percent) {
      progressFills.forEach((el, i) => {
        el.style.width =
          i === activeSegIndex
            ? `${Math.min(100, Math.max(0, percent * 100))}%`
            : "0%";
      });
    }

    function progressTick(now) {
      const elapsed = now - progressStart;
      const percent = elapsed / intervalMs;
      setProgressWidths(percent);
      if (percent < 1) {
        rafId = requestAnimationFrame(progressTick);
      } else {
        cancelAnimationFrame(rafId);
      }
    }

    function startProgress(segIndex) {
      activeSegIndex = segIndex;
      progressStart = performance.now();
      cancelAnimationFrame(rafId);
      setProgressWidths(0);
      rafId = requestAnimationFrame(progressTick);
    }

    function pauseProgress() {
      cancelAnimationFrame(rafId);
    }

    function resumeProgress() {
      const activeEl = progressFills[activeSegIndex];
      if (!activeEl) return;
      const segmentWidth = activeEl.parentElement.offsetWidth;
      const currentWidth = activeEl.offsetWidth;
      const currentPercent = segmentWidth ? currentWidth / segmentWidth : 0;
      progressStart = performance.now() - currentPercent * intervalMs;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(progressTick);
    }

    function next() {
      index += 1;
      setTransition(autoDurationMs);
      slider.style.transform = `translateX(-${index * 100}%)`;
      const segIndex = index % originalCount;
      startProgress(segIndex);
    }

    function prev() {
      index -= 1;
      if (index < 0) {
        // Jump to last real slide without animation
        slider.style.transition = "none";
        index = originalCount - 1;
        slider.style.transform = `translateX(-${index * 100}%)`;
        void slider.offsetHeight;
        setTransition(manualDurationMs);
      } else {
        setTransition(manualDurationMs);
        slider.style.transform = `translateX(-${index * 100}%)`;
      }
      startProgress(index % originalCount);
    }

    slider.addEventListener("transitionend", () => {
      // If we've reached the clone, jump back to real first without reversing
      if (index === slideCountWithClone - 1) {
        slider.style.transition = "none";
        index = 0;
        slider.style.transform = "translateX(0)";
        // Force reflow to apply the immediate jump, then restore transition
        void slider.offsetHeight;
        setTransition(autoDurationMs);

        // Restart progress for first segment after loop jump
        startProgress(0);
      }
    });

    // Auto-slide
    let timer = null;

    // Pause on hover
    section.addEventListener("mouseenter", () => {
      clearInterval(timer);
      pauseProgress();
    });
    section.addEventListener("mouseleave", () => {
      resumeProgress();
      timer = setInterval(next, intervalMs);
    });

    // Initialize first progress
    startProgress(0);

    // Make indicators clickable to jump slides
    const progressSegments = Array.from(
      section.querySelectorAll(".progress-segment")
    );
    progressSegments.forEach((seg, i) => {
      seg.addEventListener("click", () => {
        clearInterval(timer);
        setTransition(manualDurationMs);
        index = i;
        slider.style.transform = `translateX(-${index * 100}%)`;
        startProgress(i);
        timer = setInterval(next, intervalMs);
      });
    });

    // Prev/Next buttons
    const prevBtn = section.querySelector(".nav-btn.prev");
    const nextBtn = section.querySelector(".nav-btn.next");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        clearInterval(timer);
        prev();
        timer = setInterval(next, intervalMs);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        clearInterval(timer);
        next();
        timer = setInterval(next, intervalMs);
      });
    }

    // Start autoslide
    timer = setInterval(next, intervalMs);
  });
}

// Initialize all heroes
initInfiniteSlider(".hero");

// ===== Scroll to Top Button =====
const scrollToTopBtn = document.getElementById("scrollToTop");

function toggleScrollButton() {
  if (window.pageYOffset > 300) {
    scrollToTopBtn?.classList.add("visible");
  } else {
    scrollToTopBtn?.classList.remove("visible");
  }
}

// Debounced scroll handler for better performance
let scrollTimeout;
window.addEventListener(
  "scroll",
  () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(toggleScrollButton, 100);
  },
  { passive: true }
);

scrollToTopBtn?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});

// ===== Header Scroll Effect =====
const header = document.querySelector("header");
let lastScroll = 0;

window.addEventListener(
  "scroll",
  () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header?.classList.add("scrolled");
    } else {
      header?.classList.remove("scrolled");
    }

    lastScroll = currentScroll;
  },
  { passive: true }
);

// ===== Intersection Observer for Lazy Loading Images =====
if ("IntersectionObserver" in window) {
  const imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          }
          img.classList.add("loaded");
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: "50px 0px",
      threshold: 0.01,
    }
  );

  // Observe all lazy images
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
    imageObserver.observe(img);
  });
}

// ===== Keyboard Navigation Enhancement =====
document.addEventListener("keydown", (e) => {
  // Escape key closes any modal or overlay (if implemented)
  if (e.key === "Escape") {
    // Close modals, overlays, etc.
  }

  // Arrow keys for slideshow navigation when focused
  const activeElement = document.activeElement;
  if (activeElement && activeElement.closest(".hero")) {
    const heroSection = activeElement.closest(".hero");
    const prevBtn = heroSection.querySelector(".nav-btn.prev");
    const nextBtn = heroSection.querySelector(".nav-btn.next");

    if (e.key === "ArrowLeft" && prevBtn) {
      e.preventDefault();
      prevBtn.click();
    } else if (e.key === "ArrowRight" && nextBtn) {
      e.preventDefault();
      nextBtn.click();
    }
  }
});

// ===== Touch Gestures for Mobile Sliders =====
let touchStartX = 0;
let touchEndX = 0;

document.querySelectorAll(".hero").forEach((hero) => {
  hero.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  hero.addEventListener(
    "touchend",
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe(hero);
    },
    { passive: true }
  );
});

function handleSwipe(hero) {
  const swipeThreshold = 50;
  const diff = touchStartX - touchEndX;

  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // Swipe left - next slide
      hero.querySelector(".nav-btn.next")?.click();
    } else {
      // Swipe right - previous slide
      hero.querySelector(".nav-btn.prev")?.click();
    }
  }
}

// ===== Performance Optimization: Reduce Motion for Accessibility =====
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

if (prefersReducedMotion.matches) {
  document.querySelectorAll(".hero .slider").forEach((slider) => {
    slider.style.transition = "none";
  });
}

// ===== Smooth Reveal Animation on Scroll =====
const revealElements = document.querySelectorAll(".hero, .footer-section");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  }
);

revealElements.forEach((el) => revealObserver.observe(el));

// ===== Page Load Performance =====
window.addEventListener("load", () => {
  document.body.classList.add("loaded");

  // Preload critical images
  const criticalImages = document.querySelectorAll('img[loading="eager"]');
  criticalImages.forEach((img) => {
    const tempImg = new Image();
    tempImg.src = img.src;
  });
});

// ===== Error Handling for Images =====
document.querySelectorAll("img").forEach((img) => {
  img.addEventListener("error", function () {
    this.style.display = "none";
    console.warn(`Failed to load image: ${this.src}`);
  });
});

console.log("✨ Enhanced Xiaomi website loaded successfully!");

// ===== Shopping Cart Functionality =====
const Cart = {
  items: JSON.parse(localStorage.getItem("xiaomiCart")) || [],

  init() {
    this.updateCartCount();
    this.setupAddToCartButtons();
    this.setupCartModal();
  },

  addItem(product) {
    const existingItem = this.items.find((item) => item.name === product.name);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.items.push({ ...product, quantity: 1 });
    }
    this.save();
    this.updateCartCount();
    this.showNotification(`${product.name} 已加入购物车`);
  },

  removeItem(name) {
    this.items = this.items.filter((item) => item.name !== name);
    this.save();
    this.updateCartCount();
    this.renderCartModal();
  },

  updateQuantity(name, change) {
    const item = this.items.find((item) => item.name === name);
    if (item) {
      item.quantity += change;
      if (item.quantity <= 0) {
        this.removeItem(name);
      } else {
        this.save();
        this.renderCartModal();
      }
    }
  },

  getTotal() {
    return this.items.reduce((total, item) => {
      const price = parseInt(item.price.replace(/[^\d]/g, ""));
      return total + price * item.quantity;
    }, 0);
  },

  getTotalItems() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  },

  save() {
    localStorage.setItem("xiaomiCart", JSON.stringify(this.items));
  },

  updateCartCount() {
    const countElements = document.querySelectorAll(".cart-count");
    const totalItems = this.getTotalItems();
    countElements.forEach((el) => {
      el.textContent = totalItems;
      el.style.display = totalItems > 0 ? "flex" : "none";
    });
  },

  showNotification(message) {
    // Remove existing notification
    const existing = document.querySelector(".cart-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = "cart-notification";
    notification.innerHTML = `
      <i class="fa-solid fa-check-circle"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add("show"), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  setupAddToCartButtons() {
    // Add "Add to Cart" button to each product card
    document.querySelectorAll(".phone-card, .tv-card").forEach((card) => {
      // Prevent default link behavior
      card.addEventListener("click", (e) => {
        e.preventDefault();
      });

      // Get product info
      const name = card.querySelector("h3")?.textContent || "Product";
      const price = card.querySelector(".price")?.textContent || "0元";
      const img = card.querySelector("img")?.src || "";
      const sub = card.querySelector(".sub")?.textContent || "";

      // Create add to cart button
      const addBtn = document.createElement("button");
      addBtn.className = "add-to-cart-btn";
      addBtn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> 加入购物车';
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.addItem({ name, price, img, sub });

        // Button feedback
        addBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已加入';
        addBtn.classList.add("added");
        setTimeout(() => {
          addBtn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> 加入购物车';
          addBtn.classList.remove("added");
        }, 1500);
      });

      card.appendChild(addBtn);
    });
  },

  setupCartModal() {
    // Create cart modal
    const modal = document.createElement("div");
    modal.className = "cart-modal";
    modal.innerHTML = `
      <div class="cart-modal-content">
        <div class="cart-modal-header">
          <h2><i class="fa-solid fa-cart-shopping"></i> 购物车</h2>
          <button class="cart-modal-close" aria-label="关闭">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="cart-modal-body"></div>
        <div class="cart-modal-footer">
          <div class="cart-total">
            <span>总计:</span>
            <strong class="cart-total-price">¥0</strong>
          </div>
          <button class="cart-checkout-btn">结算</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close modal
    modal.querySelector(".cart-modal-close").addEventListener("click", () => {
      modal.classList.remove("open");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("open");
      }
    });

    // Checkout button
    modal.querySelector(".cart-checkout-btn").addEventListener("click", () => {
      if (this.items.length > 0) {
        this.showNotification("感谢您的购买！订单已提交 🎉");
        this.items = [];
        this.save();
        this.updateCartCount();
        this.renderCartModal();
        modal.classList.remove("open");
      }
    });

    // Open cart modal on cart button click
    document.querySelectorAll(".cart-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.renderCartModal();
        modal.classList.add("open");
      });
    });
  },

  renderCartModal() {
    const body = document.querySelector(".cart-modal-body");
    const totalPrice = document.querySelector(".cart-total-price");

    if (this.items.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <i class="fa-solid fa-cart-shopping"></i>
          <p>购物车是空的</p>
          <span>快去添加商品吧！</span>
        </div>
      `;
    } else {
      body.innerHTML = this.items
        .map(
          (item) => `
        <div class="cart-item">
          <img src="${item.img}" alt="${item.name}">
          <div class="cart-item-info">
            <h4>${item.name}</h4>
            <p class="cart-item-sub">${item.sub}</p>
            <p class="cart-item-price">${item.price}</p>
          </div>
          <div class="cart-item-quantity">
            <button class="qty-btn minus" data-name="${item.name}">-</button>
            <span>${item.quantity}</span>
            <button class="qty-btn plus" data-name="${item.name}">+</button>
          </div>
          <button class="cart-item-remove" data-name="${item.name}" aria-label="删除">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `
        )
        .join("");

      // Add event listeners for quantity buttons
      body.querySelectorAll(".qty-btn.minus").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.updateQuantity(btn.dataset.name, -1)
        );
      });

      body.querySelectorAll(".qty-btn.plus").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.updateQuantity(btn.dataset.name, 1)
        );
      });

      body.querySelectorAll(".cart-item-remove").forEach((btn) => {
        btn.addEventListener("click", () => this.removeItem(btn.dataset.name));
      });
    }

    totalPrice.textContent = `¥${this.getTotal().toLocaleString()}`;
  },
};

// Initialize cart when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  Cart.init();
  ProductDetail.init();
});

// ===== Product Detail Slide =====
const ProductDetail = {
  currentProduct: null,

  // Product specifications data (mock data - you can expand this)
  productSpecs: {
    "Xiaomi 17 Ultra 徕卡版": {
      specs: [
        { label: "屏幕", value: '6.73" 2K AMOLED, 120Hz' },
        { label: "处理器", value: "骁龙8 Gen 3" },
        { label: "内存", value: "16GB LPDDR5X" },
        { label: "存储", value: "512GB / 1TB" },
        { label: "主摄", value: "2亿像素 徕卡光学镜头" },
        { label: "电池", value: "5500mAh, 120W快充" },
      ],
      colors: ["#1a1a1a", "#f5f5f5", "#2c5f2d"],
      colorNames: ["星曜黑", "光影白", "橄榄绿"],
      gallery: [],
      features: ["徕卡影像系统", "卫星通信", "IP68防水", "超声波指纹"],
    },
    default: {
      specs: [
        { label: "屏幕", value: '6.67" AMOLED, 120Hz' },
        { label: "处理器", value: "骁龙8系列" },
        { label: "内存", value: "12GB / 16GB" },
        { label: "存储", value: "256GB / 512GB" },
        { label: "相机", value: "5000万像素主摄" },
        { label: "电池", value: "5000mAh, 67W快充" },
      ],
      colors: ["#1a1a1a", "#f5f5f5", "#1e3a5f"],
      colorNames: ["黑色", "白色", "蓝色"],
      gallery: [],
      features: ["旗舰性能", "超长续航", "高清影像", "快速充电"],
    },
  },

  init() {
    this.createDetailModal();
    this.setupProductClicks();
  },

  createDetailModal() {
    const modal = document.createElement("div");
    modal.className = "product-detail-modal";
    modal.innerHTML = `
      <div class="product-detail-slide">
        <button class="detail-close-btn" aria-label="关闭">
          <i class="fa-solid fa-times"></i>
        </button>
        
        <div class="detail-content">
          <div class="detail-gallery">
            <div class="detail-main-image">
              <img src="" alt="" id="detailMainImg">
            </div>
            <div class="detail-thumbnails"></div>
          </div>
          
          <div class="detail-info">
            <div class="detail-badge-row"></div>
            <h1 class="detail-title"></h1>
            <p class="detail-subtitle"></p>
            <div class="detail-price-row">
              <span class="detail-price"></span>
              <span class="detail-original-price"></span>
            </div>
            
            <div class="detail-colors">
              <h4>颜色选择</h4>
              <div class="color-options"></div>
            </div>
            
            <div class="detail-features">
              <h4>产品特点</h4>
              <div class="feature-tags"></div>
            </div>
            
            <div class="detail-specs">
              <h4>规格参数</h4>
              <div class="specs-grid"></div>
            </div>
            
            <div class="detail-actions">
              <button class="detail-add-cart">
                <i class="fa-solid fa-cart-plus"></i>
                加入购物车
              </button>
              <button class="detail-buy-now">
                立即购买
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close button
    modal.querySelector(".detail-close-btn").addEventListener("click", () => {
      this.close();
    });

    // Click outside to close
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.close();
      }
    });

    // ESC key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) {
        this.close();
      }
    });

    // Add to cart button
    modal.querySelector(".detail-add-cart").addEventListener("click", () => {
      if (this.currentProduct) {
        Cart.addItem(this.currentProduct);
        const btn = modal.querySelector(".detail-add-cart");
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 已加入购物车';
        btn.classList.add("added");
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> 加入购物车';
          btn.classList.remove("added");
        }, 2000);
      }
    });

    // Buy now button
    modal.querySelector(".detail-buy-now").addEventListener("click", () => {
      if (this.currentProduct) {
        Cart.addItem(this.currentProduct);
        Cart.showNotification("正在跳转到结算页面...");
        setTimeout(() => {
          document.querySelector(".cart-btn")?.click();
        }, 500);
        this.close();
      }
    });
  },

  setupProductClicks() {
    document.querySelectorAll(".phone-card, .tv-card").forEach((card) => {
      // Add view detail button
      const viewBtn = document.createElement("button");
      viewBtn.className = "view-detail-btn";
      viewBtn.innerHTML = '<i class="fa-solid fa-eye"></i> 查看详情';
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.openFromCard(card);
      });
      card.appendChild(viewBtn);

      // Also open on card click (but not on add-to-cart button)
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".add-to-cart-btn")) {
          e.preventDefault();
          this.openFromCard(card);
        }
      });
    });
  },

  openFromCard(card) {
    const name = card.querySelector("h3")?.textContent || "Product";
    const price = card.querySelector(".price")?.textContent || "0元";
    const img = card.querySelector("img")?.src || "";
    const sub = card.querySelector(".sub")?.textContent || "";
    const badge = card.querySelector(".badge")?.textContent || "";

    this.currentProduct = { name, price, img, sub };
    this.render({ name, price, img, sub, badge });
    this.open();
  },

  render(product) {
    const modal = document.querySelector(".product-detail-modal");
    const specs =
      this.productSpecs[product.name] || this.productSpecs["default"];

    // Main image
    modal.querySelector("#detailMainImg").src = product.img;
    modal.querySelector("#detailMainImg").alt = product.name;

    // Badge
    const badgeRow = modal.querySelector(".detail-badge-row");
    if (product.badge) {
      badgeRow.innerHTML = `<span class="detail-badge">${product.badge}</span>`;
    } else {
      badgeRow.innerHTML = "";
    }

    // Title and subtitle
    modal.querySelector(".detail-title").textContent = product.name;
    modal.querySelector(".detail-subtitle").textContent = product.sub;

    // Price
    const priceNum = parseInt(product.price.replace(/[^\d]/g, ""));
    const originalPrice = Math.round(priceNum * 1.15);
    modal.querySelector(".detail-price").textContent = product.price;
    modal.querySelector(
      ".detail-original-price"
    ).textContent = `¥${originalPrice}`;

    // Colors
    const colorOptions = modal.querySelector(".color-options");
    colorOptions.innerHTML = specs.colors
      .map(
        (color, i) => `
      <div class="color-option ${i === 0 ? "active" : ""}" 
           style="background: ${color}" 
           data-color="${specs.colorNames[i]}"
           title="${specs.colorNames[i]}">
      </div>
    `
      )
      .join("");

    // Color click events
    colorOptions.querySelectorAll(".color-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        colorOptions
          .querySelectorAll(".color-option")
          .forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        Cart.showNotification(`已选择: ${opt.dataset.color}`);
      });
    });

    // Features
    modal.querySelector(".feature-tags").innerHTML = specs.features
      .map(
        (f) => `
      <span class="feature-tag"><i class="fa-solid fa-check"></i> ${f}</span>
    `
      )
      .join("");

    // Specs
    modal.querySelector(".specs-grid").innerHTML = specs.specs
      .map(
        (s) => `
      <div class="spec-item">
        <span class="spec-label">${s.label}</span>
        <span class="spec-value">${s.value}</span>
      </div>
    `
      )
      .join("");
  },

  open() {
    const modal = document.querySelector(".product-detail-modal");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  },

  close() {
    const modal = document.querySelector(".product-detail-modal");
    modal.classList.remove("open");
    document.body.style.overflow = "";
  },
};

// ===== Mobile Menu =====
const MobileMenu = {
  init() {
    const menuBtn = document.querySelector(".mobile-menu-btn");
    const navbar = document.querySelector("header .navbar");

    if (!menuBtn || !navbar) return;

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "mobile-menu-overlay";
    document.body.appendChild(overlay);

    // Toggle menu
    menuBtn.addEventListener("click", () => {
      const isOpen = navbar.classList.contains("open");

      if (isOpen) {
        this.close(menuBtn, navbar, overlay);
      } else {
        this.open(menuBtn, navbar, overlay);
      }
    });

    // Close on overlay click
    overlay.addEventListener("click", () => {
      this.close(menuBtn, navbar, overlay);
    });

    // Close on nav link click
    navbar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        this.close(menuBtn, navbar, overlay);
      });
    });

    // Close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navbar.classList.contains("open")) {
        this.close(menuBtn, navbar, overlay);
      }
    });

    // Close on window resize (if screen gets larger)
    window.addEventListener("resize", () => {
      if (window.innerWidth > 991 && navbar.classList.contains("open")) {
        this.close(menuBtn, navbar, overlay);
      }
    });
  },

  open(btn, nav, overlay) {
    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
    nav.classList.add("open");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  },

  close(btn, nav, overlay) {
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
    nav.classList.remove("open");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  },
};

// Initialize mobile menu
document.addEventListener("DOMContentLoaded", () => {
  MobileMenu.init();
});
