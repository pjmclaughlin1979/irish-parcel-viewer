import OAuthInfo from "@arcgis/core/identity/OAuthInfo.js";
import esriId from "@arcgis/core/identity/IdentityManager.js";
import Portal from "@arcgis/core/portal/Portal.js";

const PORTAL_URL = "https://www.arcgis.com";
const OAUTH_APP_ID = "VqHCYXLpavLxvb59";

let oauthInitialized = false;

export type ArcgisUser = {
  username: string;
  fullName: string;
};

function initializeOAuth() {
  if (oauthInitialized) return;

  esriId.registerOAuthInfos([
    new OAuthInfo({
      appId: OAUTH_APP_ID,
      portalUrl: PORTAL_URL,
      popup: false,
      preserveUrlHash: true,
    }),
  ]);
  oauthInitialized = true;
}

export async function checkArcgisSignIn(): Promise<ArcgisUser | null> {
  initializeOAuth();
  try {
    await esriId.checkSignInStatus(`${PORTAL_URL}/sharing`);
    return loadArcgisUser();
  } catch {
    return null;
  }
}

export async function signInToArcgis(): Promise<ArcgisUser> {
  initializeOAuth();
  await esriId.getCredential(`${PORTAL_URL}/sharing`);
  return loadArcgisUser();
}

export function signOutOfArcgis() {
  esriId.destroyCredentials();
}

async function loadArcgisUser(): Promise<ArcgisUser> {
  const portal = new Portal({ url: PORTAL_URL });
  await portal.load();
  return {
    username: portal.user?.username ?? "",
    fullName: portal.user?.fullName ?? portal.user?.username ?? "",
  };
}
