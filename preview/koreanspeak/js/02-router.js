import { store } from './01-state.js';

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.transitionDuration = 300;
    this.history = [];
  }

  register(route, renderer) {
    this.routes.set(route, renderer);
    return this;
  }

  navigate(route, params = {}, options = {}) {
    const renderer = this.routes.get(route);
    if (!renderer) {
      console.warn(`Route not found: ${route}`);
      return;
    }

    const app = document.getElementById('app');
    const currentScreen = app.querySelector('.screen.active');

    if (currentScreen && !options.replace) {
      this.history.push(this.currentRoute);
      // L12: immediately block interaction on the outgoing screen during transition
      currentScreen.style.pointerEvents = 'none';
      currentScreen.classList.remove('active');
      setTimeout(() => {
        if (currentScreen.parentNode) {
          currentScreen.remove();
        }
      }, this.transitionDuration);
    } else if (currentScreen && options.replace) {
      currentScreen.remove();
    }

    const newScreen = renderer(params);
    if (newScreen) {
      newScreen.classList.add('screen');
      if (!newScreen.id) {
        newScreen.id = `screen-${route}`;
      }
      app.appendChild(newScreen);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newScreen.classList.add('active');
        });
      });
    }

    this.currentRoute = route;
    store.setState({
      currentScreen: route,
      previousScreen: this.history[this.history.length - 1] || null
    });

    this.updateNav(route);

    if (typeof gtag !== 'undefined') {
      gtag('event', 'screen_view', { screen_name: route });
    }
  }

  back() {
    const previous = this.history.pop();
    if (previous) {
      this.navigate(previous, {}, { replace: true });
    } else {
      this.navigate('home', {}, { replace: true });
    }
  }

  updateNav(activeRoute) {
    // L9: use CSS class instead of inline style so :focus-visible ring is not overridden
    document.querySelectorAll('.nav-item').forEach(item => {
      const screen = item.dataset.screen;
      const isActive = screen === activeRoute;
      item.classList.toggle('active', isActive);
      item.style.color = '';
    });
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  canGoBack() {
    return this.history.length > 0;
  }
}

const router = new Router();

export { router };
