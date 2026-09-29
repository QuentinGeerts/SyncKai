console.log('Popup chargé');

const loginBtn = document.querySelector<HTMLButtonElement>('#login-btn');

loginBtn?.addEventListener('click', (): void => {
  // TODO: déclencher le flux OAuth2 AniList via le service worker
  console.log('Clic sur "Se connecter à AniList"');
});
