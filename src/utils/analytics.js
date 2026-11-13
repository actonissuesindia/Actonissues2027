// Loads Google Tag Manager / Google Analytics (gtag.js) / Microsoft Clarity
// only when their ID is actually configured — a from-scratch deployment with
// no VITE_* analytics vars set gets zero injected scripts, not broken/empty
// ones. Each provider's snippet is the vendor's standard install code,
// translated from inline <script> tags into DOM injection since Vite's
// index.html isn't templated per-environment.
export function initAnalytics() {
  const gtmId = import.meta.env.VITE_GTM_ID;
  const gaId = import.meta.env.VITE_GA_ID;
  const clarityId = import.meta.env.VITE_CLARITY_ID;

  if (gtmId) initGoogleTagManager(gtmId);
  if (gaId) initGoogleAnalytics(gaId);
  if (clarityId) initClarity(clarityId);
}

function initGoogleTagManager(id) {
  const script = document.createElement('script');
  script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`;
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${id}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);
}

function initGoogleAnalytics(id) {
  const loader = document.createElement('script');
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(loader);

  const inline = document.createElement('script');
  inline.innerHTML = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`;
  document.head.appendChild(inline);
}

function initClarity(id) {
  const script = document.createElement('script');
  script.innerHTML = `(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${id}");`;
  document.head.appendChild(script);
}
