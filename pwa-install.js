(function () {
  'use strict';

  let deferredInstallPrompt = null;

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isIOS() {
    return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') && !window.MSStream;
  }

  function isLikelyInAppBrowser() {
    const ua = navigator.userAgent || '';
    return /Line\//i.test(ua) || /FBAN|FBAV|Instagram|GSA|wv\)/i.test(ua);
  }

  function getInstallButtons() {
    return [
      document.getElementById('pwaInstallMenuBtn'),
      document.getElementById('pwaInstallTopBtn'),
      document.getElementById('pwaInstallAuthBtn')
    ].filter(Boolean);
  }

  function updateInstallButtons() {
    const installed = isStandaloneMode();
    document.documentElement.classList.toggle('pwa-standalone', installed);
    getInstallButtons().forEach((button) => {
      button.classList.toggle('hidden', installed);
    });
  }

  function setInstallModalMessage(message, canPrompt) {
    const modal = document.getElementById('pwaInstallModal');
    const messageBox = document.getElementById('pwaInstallMessage');
    const confirmButton = document.getElementById('pwaInstallConfirmBtn');
    if (!modal || !messageBox || !confirmButton) return;

    messageBox.innerHTML = message;
    confirmButton.classList.toggle('hidden', !canPrompt);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function showManualInstallHelp() {
    if (isIOS()) {
      setInstallModalMessage(
        '<strong>iPhone/iPad:</strong><br>1. เปิดด้วย Safari<br>2. กดปุ่มแชร์ ⬆️<br>3. เลือก “เพิ่มไปยังหน้าจอโฮม”<br>4. กด “เพิ่ม”',
        false
      );
      return;
    }

    if (isAndroid()) {
      const inAppText = isLikelyInAppBrowser()
        ? '<br><br><strong>ตอนนี้น่าจะเปิดผ่านแอปอื่น:</strong> ให้แตะเมนูของหน้านี้แล้วเลือก “เปิดใน Chrome” ก่อน'
        : '';
      setInstallModalMessage(
        '<strong>Android:</strong><br>1. เปิดลิงก์ด้วย Google Chrome<br>2. แตะเมนู ⋮ มุมขวาบน<br>3. เลือก “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”<br>4. กดยืนยันการติดตั้ง' + inAppText + '<br><br>หากเคยเพิ่มทางลัดแบบเดิม ให้ลบไอคอนเดิมก่อนแล้วติดตั้งใหม่',
        false
      );
      return;
    }

    setInstallModalMessage(
      '<strong>คอมพิวเตอร์:</strong><br>เปิดด้วย Chrome หรือ Edge แล้วกดสัญลักษณ์ติดตั้งที่ด้านขวาของช่องที่อยู่ หรือเลือกเมนู “ติดตั้งแอป”',
      false
    );
  }

  async function installPwaApp() {
    if (isStandaloneMode()) {
      setInstallModalMessage('แอปนี้ติดตั้งอยู่แล้ว และกำลังเปิดในโหมดแอปค่ะ', false);
      return;
    }

    if (!deferredInstallPrompt) {
      showManualInstallHelp();
      return;
    }

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === 'accepted') {
        updateInstallButtons();
      } else {
        updateInstallButtons();
      }
    } catch (error) {
      console.warn('PWA install prompt failed:', error);
      showManualInstallHelp();
    }
  }

  function closePwaInstallModal() {
    const modal = document.getElementById('pwaInstallModal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function copyPwaAppLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const messageBox = document.getElementById('pwaInstallMessage');
      if (messageBox) messageBox.insertAdjacentHTML('beforeend', '<div class="pwa-copy-success">คัดลอกลิงก์แล้ว</div>');
    } catch (error) {
      window.prompt('คัดลอกลิงก์นี้', window.location.href);
    }
  }

  window.installPwaApp = installPwaApp;
  window.closePwaInstallModal = closePwaInstallModal;
  window.copyPwaAppLink = copyPwaAppLink;

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtons();
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    updateInstallButtons();
    closePwaInstallModal();
  });

  window.addEventListener('load', function () {
    updateInstallButtons();

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(function (registration) {
          registration.update().catch(function () {});
        })
        .catch(function (error) {
          console.warn('Service Worker registration failed:', error);
        });
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closePwaInstallModal();
  });
})();
