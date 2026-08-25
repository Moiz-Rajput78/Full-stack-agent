import {
  googleOAuthClient,
  GOOGLE_CALENDAR_SCOPES,
} from "../config/google.js";

export function createGoogleAuthorizationUrl(
  state: string,
) {
  return googleOAuthClient.generateAuthUrl({
    access_type: "offline",

    prompt: "consent",

    scope: GOOGLE_CALENDAR_SCOPES,

    state,

    include_granted_scopes: true,
  });
}

export async function exchangeGoogleCode(
  code: string,
) {
  const { tokens } =
    await googleOAuthClient.getToken(code);

  return tokens;
}
