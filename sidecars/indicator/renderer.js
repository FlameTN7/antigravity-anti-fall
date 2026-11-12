(() => {
  if (window.__antigravityModelRouterBadgeInstalled) return;
  window.__antigravityModelRouterBadgeInstalled = true;

  const BADGE_ID = 'antigravity-routed-model-badge';
  let currentModelData = null;
  let copyFeedbackTimer = null;

  // Extracts conversation ID from pathname /c/<id>
  function getActiveConversationId() {
    const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  let lastConvId = getActiveConversationId();

  // Create or get badge element
  function ensureBadge() {
    const btn = document.querySelector('button[data-testid="permissions-selector-trigger"]');
    if (!btn || !btn.parentElement) return null;

    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = BADGE_ID;
      badge.className = 'flex items-center h-7 gap-1 rounded-full px-2.5 text-xs font-mono select-none transition-all cursor-pointer shrink-0';
      badge.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      badge.style.border = '1px solid rgba(255, 255, 255, 0.12)';
      badge.style.color = 'var(--secondary-foreground, #cad3f5)';
      badge.style.fontSize = '11px';
      badge.style.lineHeight = '1';
      badge.style.marginRight = '2px';

      // Hover styling
      badge.addEventListener('mouseenter', () => {
        badge.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
        badge.style.borderColor = 'rgba(96, 165, 250, 0.4)';
      });
      badge.addEventListener('mouseleave', () => {
        badge.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        badge.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      });

      // Click to copy
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentModelData?.routedModel) return;
        
        navigator.clipboard.writeText(currentModelData.routedModel).then(() => {
          showCopyFeedback();
        }).catch(() => {});
      });

      renderBadgeContent(badge, currentModelData);
      btn.parentElement.insertBefore(badge, btn);
    } else if (badge.nextElementSibling !== btn) {
      // Re-position before button if DOM shifted
      btn.parentElement.insertBefore(badge, btn);
    }

    return badge;
  }

  function renderBadgeContent(badge, data) {
    if (!badge) return;
    const model = data?.routedModel || 'loading...';
    const displayName = data?.displayName || model;
    const updatedAt = data?.updatedAt || '';
    const idx = data?.idx != null ? `#${data.idx}` : '';

    badge.title = data ? 
      `实际路由模型: ${model}\n配置展示模型: ${displayName}\n最近响应更新: ${updatedAt} (${idx})\n\n💡 点击可将底层模型端点标识复制到剪贴板` : 
      '等待最新请求路由...';

    badge.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span class="model-badge-text" style="font-weight: 500; letter-spacing: -0.2px;">${escapeHtml(model)}</span>
    `;
  }

  function showCopyFeedback() {
    const badge = document.getElementById(BADGE_ID);
    if (!badge) return;
    const textEl = badge.querySelector('.model-badge-text');
    if (!textEl) return;

    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    
    textEl.textContent = '✓ 已复制';
    textEl.style.color = '#34d399';
    badge.style.borderColor = 'rgba(52, 211, 153, 0.5)';

    copyFeedbackTimer = setTimeout(() => {
      textEl.textContent = currentModelData?.routedModel || '';
      textEl.style.color = '';
      badge.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    }, 1200);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  // Exposed API called by sidecar via CDP Runtime.evaluate
  window.__updateRoutedModelBadge = (data) => {
    currentModelData = data;
    const badge = ensureBadge();
    if (badge) renderBadgeContent(badge, data);
  };

  // Observer to keep badge attached across React re-renders
  const observer = new MutationObserver(() => {
    ensureBadge();

    // Check conversation change
    const convId = getActiveConversationId();
    if (convId && convId !== lastConvId) {
      lastConvId = convId;
      notifyRouteChange(convId);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Route change notification to sidecar
  function notifyRouteChange(convId) {
    if (typeof window.__modelRouterBadgeBinding === 'function') {
      try {
        window.__modelRouterBadgeBinding(JSON.stringify({ type: 'route_change', convId }));
      } catch {}
    }
  }

  // Initial check
  ensureBadge();
  const initConvId = getActiveConversationId();
  if (initConvId) {
    notifyRouteChange(initConvId);
  }
})();
