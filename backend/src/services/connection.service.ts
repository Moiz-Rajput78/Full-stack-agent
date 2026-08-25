import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { getCalendarAccessToken } from "./token.service.js";
import {
  getCalendarConnectionRow,
  upsertCalendarConnection,
} from "../repositories/connection.repository.js";

const CALENDAR_CONNECTION_ID =
  process.env.DESCOPE_CALENDAR_CONNECTION_ID;


export async function getCalendarConnection(input: {
  userId: string;
}) {
  return getCalendarConnectionRow(input.userId);
}


function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();

  auth.setCredentials({
    access_token: accessToken,
  });

  return google.calendar({
    version: "v3",
    auth,
  });
}


async function calendarForUser(authUserId: string) {
  const accessToken = await getCalendarAccessToken(authUserId);

  return calendarClient(accessToken);
}

/**
 * Create/update the calendar connection record.
 *
 * NOTE:
 * The refreshToken is currently accepted by the route,
 * but this function does not send it anywhere because the
 * current token.service.ts does not expose a method for
 * storing/registering it with Descope.
 */
export async function createCalendarConnection(input: {
  userId: string;
  refreshToken?: string;
  redirectUrl: string;
}) {
  if (!CALENDAR_CONNECTION_ID) {
    throw new Error(
      "DESCOPE_CALENDAR_CONNECTION_ID is not configured",
    );
  }

  if (!process.env.DESCOPE_PROJECT_ID) {
    throw new Error(
      "DESCOPE_PROJECT_ID is not configured",
    );
  }

  if (!process.env.DESCOPE_MANAGEMENT_KEY) {
    throw new Error(
      "DESCOPE_MANAGEMENT_KEY is not configured",
    );
  }

  if (!input.redirectUrl.trim()) {
    throw new Error("Redirect URL is required");
  }

  /*
   * Ask Descope to create the actual OAuth authorization URL.
   *
   * This is the important part that was missing before.
   */
  const response = await fetch(
    "https://api.descope.com/v1/mgmt/outbound/app/connect",
    {
      method: "POST",

      headers: {
        "Authorization":
          `Bearer ${process.env.DESCOPE_PROJECT_ID}:${process.env.DESCOPE_MANAGEMENT_KEY}`,

        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        appId: CALENDAR_CONNECTION_ID,

        options: {
          redirectUrl: input.redirectUrl,
        },
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "Descope outbound connection error:",
      data,
    );

    throw new Error(
      data?.error ??
        data?.message ??
        "Could not create calendar authorization URL.",
    );
  }

  if (!data?.url) {
    console.error(
      "Descope did not return authorization URL:",
      data,
    );

    throw new Error(
      "Descope did not return a calendar authorization URL.",
    );
  }

  /*
   * Keep your local connection record.
   */
  const connection =
    await upsertCalendarConnection({
      userId: input.userId,
      status: "pending",
    });

  return {
    url: data.url,
    connection,
  };
}





/**
 * Refresh/check the current calendar connection status.
 */
export async function refreshCalendarStatus(input: {
  userId: string;
  authUserId: string;
}) {
  const existingConnection =
    await getCalendarConnectionRow(input.userId);

  if (!existingConnection) {
    return await upsertCalendarConnection({
      userId: input.userId,
      status: "disconnected",
    });
  }

  try {
    await getCalendarAccessToken(input.authUserId);

    return await upsertCalendarConnection({
      userId: input.userId,
      status: "connected",
    });
  } catch (error) {
    console.error(
      "Could not verify calendar connection:",
      error,
    );

    return await upsertCalendarConnection({
      userId: input.userId,
      status: "disconnected",
    });
  }
}

function formatEvent(event: {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;

  start?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;

  end?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;

  htmlLink?: string | null;
  hangoutLink?: string | null;

  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string | null;
      uri?: string | null;
    }> | null;
  } | null;

  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
  }> | null;
}) {
  let meetLink = event.hangoutLink ?? null;

  if (!meetLink) {
    const videoEntry = (
      event.conferenceData?.entryPoints ?? []
    ).find(
      (entry) =>
        entry.entryPointType === "video" &&
        typeof entry.uri === "string",
    );

    meetLink = videoEntry?.uri ?? null;
  }

  return {
    id: event.id ?? null,

    title:
      event.summary?.trim() ||
      "(no title)",

    description:
      event.description?.trim() || null,

    location:
      event.location?.trim() || null,

    start:
      event.start?.dateTime ??
      event.start?.date ??
      null,

    end:
      event.end?.dateTime ??
      event.end?.date ??
      null,

    htmlLink:
      event.htmlLink ?? null,

    meetLink,

    attendees:
      (event.attendees ?? [])
        .map(
          (person) =>
            person.email ||
            person.displayName,
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
  };
}

/**
 * Get start/end of a local calendar day.
 */
function getLocalDayRange(offsetDays = 0) {
  const start = new Date();

  start.setHours(0, 0, 0, 0);

  start.setDate(
    start.getDate() + offsetDays,
  );

  const end = new Date(start);

  end.setDate(
    end.getDate() + 1,
  );

  end.setMilliseconds(
    end.getMilliseconds() - 1,
  );

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

export async function listUpcomingMeetings(input: {
  authUserId: string;
  maxResults?: number;
  todayOnly?: boolean;
  tomorrowOnly?: boolean;
}) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  let timeMin: string;
  let timeMax: string | undefined;

  if (input.tomorrowOnly) {
    const range =
      getLocalDayRange(1);

    timeMin = range.timeMin;
    timeMax = range.timeMax;
  } else if (input.todayOnly) {
    const range =
      getLocalDayRange(0);

    timeMin = range.timeMin;
    timeMax = range.timeMax;
  } else {
    timeMin =
      new Date().toISOString();
  }

  const response =
    await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults:
        input.maxResults ?? 20,
      singleEvents: true,
      orderBy: "startTime",
    });

  return (
    response.data.items ?? []
  ).map(formatEvent);
}

export async function createMeeting(input: {
  authUserId: string;
  title: string;
  startIso: string;
  endIso: string;
  attendeeEmails?: string[];
  description?: string;
  addGoogleMeet?: boolean;
}) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const withMeet =
    input.addGoogleMeet !== false;

  const attendeeEmails =
    input.attendeeEmails ?? [];

  const response =
    await calendar.events.insert({
      calendarId: "primary",

      sendUpdates:
        attendeeEmails.length > 0
          ? "all"
          : "none",

      conferenceDataVersion:
        withMeet ? 1 : undefined,

      requestBody: {
        summary: input.title,

        description:
          input.description,

        start: {
          dateTime:
            input.startIso,
        },

        end: {
          dateTime:
            input.endIso,
        },

        attendees:
          attendeeEmails.map(
            (email) => ({
              email,
            }),
          ),

        conferenceData:
          withMeet
            ? {
                createRequest: {
                  requestId:
                    randomUUID(),

                  conferenceSolutionKey: {
                    type:
                      "hangoutsMeet",
                  },
                },
              }
            : undefined,
      },
    });

  return {
    ...formatEvent(
      response.data,
    ),

    inviteEmailsSent:
      attendeeEmails.length > 0,

    googleMeetAdded:
      withMeet,
  };
}

export async function cancelMeeting(input: {
  authUserId: string;
  eventId: string;
}) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  await calendar.events.delete({
    calendarId: "primary",
    eventId: input.eventId,
    sendUpdates: "all",
  });

  return {
    cancelled: true,
    eventId: input.eventId,
  };
}

export async function rescheduleMeeting(input: {
  authUserId: string;
  eventId: string;
  startIso: string;
  endIso: string;
}) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const response =
    await calendar.events.patch({
      calendarId: "primary",

      eventId: input.eventId,

      sendUpdates: "all",

      requestBody: {
        start: {
          dateTime:
            input.startIso,
        },

        end: {
          dateTime:
            input.endIso,
        },
      },
    });

  return formatEvent(
    response.data,
  );
}

export async function updateMeetingAgenda(input: {
  authUserId: string;
  eventId: string;
  agenda: string;
  mode?: "append" | "replace";
}) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const mode =
    input.mode ?? "append";

  const existingEvent =
    await calendar.events.get({
      calendarId: "primary",
      eventId: input.eventId,
    });

  const existingDescription =
    existingEvent.data.description?.trim() ??
    "";

  const newAgenda =
    input.agenda.trim();

  let updatedDescription: string;

  if (mode === "replace") {
    updatedDescription =
      newAgenda;
  } else {
    updatedDescription =
      existingDescription
        ? `${existingDescription}\n\n${newAgenda}`
        : newAgenda;
  }

  const response =
    await calendar.events.patch({
      calendarId: "primary",

      eventId: input.eventId,

      requestBody: {
        description:
          updatedDescription,
      },
    });

  return formatEvent(
    response.data,
  );
}

export async function checkCalendarBusy(input: {
  authUserId: string;
  startIso: string;
  endIso: string;
}) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const response =
    await calendar.freebusy.query({
      requestBody: {
        timeMin:
          input.startIso,

        timeMax:
          input.endIso,

        items: [
          {
            id: "primary",
          },
        ],
      },
    });

  const busy =
    response.data?.calendars?.primary?.busy ??
    [];

  return {
    busy: busy.map(
      (item) => ({
        start:
          item.start ?? null,

        end:
          item.end ?? null,
      }),
    ),
  };
}
