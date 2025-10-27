// Simple analytics collector with explicit consent
(function(){
  const STORAGE_KEY = 'quizgen_analytics_consent';
  function hasConsent(){
    try { return localStorage.getItem(STORAGE_KEY) === 'granted'; } catch(e){ return false; }
  }
  function setConsent(){ try { localStorage.setItem(STORAGE_KEY,'granted'); } catch(e){} }

  function getDeviceType(){
    const ua = navigator.userAgent || '';
    if (/Mobi|Android/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  async function sendAnalytics(payload){
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e){ console.warn('Analytics send failed', e); }
  }

  function collectAndSend(){
    const payload = {
      consent: true,
      ageRange: null,
      country: null,
      city: null,
      deviceType: getDeviceType(),
      activeHours: null,
      interests: null,
      engagement: {
        path: location.pathname,
        ts: Date.now()
      }
    };
    sendAnalytics(payload);
  }

  // show a minimal consent banner
  if (!hasConsent()){
    const banner = document.createElement('div');
    banner.style.position='fixed'; banner.style.bottom='12px'; banner.style.left='12px'; banner.style.right='12px';
    banner.style.background='#111'; banner.style.color='#fff'; banner.style.padding='12px'; banner.style.zIndex=9999; banner.style.borderRadius='8px';
    banner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
      '<div style="flex:1">We use anonymous analytics to improve the site. Allow sharing anonymous usage data?</div>' +
      '<div><button id="ANALYTICS_ACCEPT" style="background:#1976ff;color:white;border:none;padding:8px 12px;border-radius:6px">Allow</button></div>' +
      '</div>';
    document.body.appendChild(banner);
    document.getElementById('ANALYTICS_ACCEPT').onclick = function(){ setConsent(); collectAndSend(); banner.remove(); };
  } else {
    collectAndSend();
  }
})();
