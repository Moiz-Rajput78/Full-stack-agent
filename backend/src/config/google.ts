import { google } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI ??
  "http://localhost:4000/api/connections/google/callback";

if (!clientId) {
  console.warn("GOOGLE_CLIENT_ID is not set");
}

if (!clientSecret) {
  console.warn("GOOGLE_CLIENT_SECRET is not set");
}

export const googleOAuthClient =
  new google.auth.OAuth2(
    clientId ?? "",
    clientSecret ?? "",
    redirectUri,
  );

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
];

export const GOOGLE_REDIRECT_URI = redirectUri;
