import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  cancelMeeting,
  checkCalendarBusy,
  createMeeting,
  listUpcomingMeetings,
  rescheduleMeeting,
  updateMeetingAgenda,
} from "./calendar.servics.js";

export function createCalendarTools(
  authUserId: string,
) {
  return {
    listUpcomingMeetings:
      createTool({
        id: "listUpcomingMeetings",

        description:
          "List Google Calendar events. Use this for questions about today's meetings, tomorrow's meetings, upcoming meetings, schedules, agendas, or the user's calendar. Returns event IDs, titles, start/end times, attendees, locations and Meet links.",

        inputSchema: z.object({
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional(),

          todayOnly: z
            .boolean()
            .optional()
            .describe(
              "If true, return only today's events.",
            ),
        }),

        execute: async ({
          maxResults,
          todayOnly,
        }) => {
          return await listUpcomingMeetings({
            authUserId,
            maxResults,
            todayOnly,
          });
        },
      }),

    checkCalendarBusy:
      createTool({
        id: "checkCalendarBusy",

        description:
          "Check whether the user's primary Google Calendar is busy between two ISO-8601 datetimes.",

        inputSchema: z.object({
          startIso: z
            .string()
            .describe(
              "Start ISO-8601 datetime",
            ),

          endIso: z
            .string()
            .describe(
              "End ISO-8601 datetime",
            ),
        }),

        execute: async ({
          startIso,
          endIso,
        }) => {
          return await checkCalendarBusy({
            authUserId,
            startIso,
            endIso,
          });
        },
      }),

    createMeeting:
      createTool({
        id: "createMeeting",

        description:
          "Create a Google Calendar meeting. Use this when the user asks to create, schedule, book or add a meeting.",

        inputSchema: z.object({
          title: z
            .string()
            .min(1),

          startIso: z
            .string()
            .describe(
              "Meeting start as ISO-8601 datetime",
            ),

          endIso: z
            .string()
            .describe(
              "Meeting end as ISO-8601 datetime",
            ),

          attendeeEmails:
            z
              .array(
                z.string().email(),
              )
              .optional(),

          description:
            z.string().optional(),

          addGoogleMeet:
            z
              .boolean()
              .optional()
              .describe(
                "Whether to add Google Meet. Defaults to true.",
              ),
        }),

        execute: async (input) => {
          return await createMeeting({
            authUserId,
            ...input,
          });
        },
      }),

    rescheduleMeeting:
      createTool({
        id: "rescheduleMeeting",

        description:
          "Reschedule an existing Google Calendar event. First find the event with listUpcomingMeetings if the event ID is not already known.",

        inputSchema: z.object({
          eventId: z
            .string()
            .min(1),

          startIso: z
            .string(),

          endIso: z
            .string(),
        }),

        execute: async (input) => {
          return await rescheduleMeeting({
            authUserId,
            ...input,
          });
        },
      }),

    updateMeetingAgenda:
      createTool({
        id: "updateMeetingAgenda",

        description:
          "Update the agenda or description of an existing Google Calendar event. Do not create a new event.",

        inputSchema: z.object({
          eventId: z
            .string()
            .min(1),

          agenda: z
            .string()
            .min(1),

          mode: z
            .enum([
              "append",
              "replace",
            ])
            .optional(),
        }),

        execute: async (input) => {
          return await updateMeetingAgenda({
            authUserId,
            ...input,
          });
        },
      }),

    cancelMeeting:
      createTool({
        id: "cancelMeeting",

        description:
          "Cancel an existing Google Calendar event. First find the event with listUpcomingMeetings if the event ID is not known.",

        inputSchema: z.object({
          eventId: z
            .string()
            .min(1),
        }),

        execute: async (input) => {
          return await cancelMeeting({
            authUserId,
            ...input,
          });
        },
      }),
  };
}