import { Router } from 'express'
import { requireSession } from '../middleware/requireSession.js'

import {
    getCalendarConnection,
    createCalendarConnectUrl,
    refreshCalendarConnection
} from '../services/connection.service.js'
export const connectionRouter = Router()

connectionRouter.use(requireSession)

connectionRouter.get("/", async (req, res) => {
    try {
        const connection = await getCalendarConnection(req.auth!.userId)

        res.json({ connection })

    } catch (error) {
        console.error("Could not load Connections:", error)

        return res.status(500).json({
            error: "Could not load Connections.",
        })
    }
})

connectionRouter.post("/connect", async (req, res) => {
    try {
        const refreshToken =
            typeof req.body?.refreshToken === 'string'
                ? req.body.refreshToken
                : ""

        if (!refreshToken) {
            return res.status(400).json({
                error: "Refresh Token Required"
            })
        }

        const redirectUrl =
            typeof req.body?.redirectUrl === 'string'
                ? req.body.redirectUrl
                : `${process.env.APP_URL ?? "http://localhost:3000"}/dashboard`

        const result = await createCalendarConnectUrl({
            userId: req.auth!.userId,
            refreshToken,
            redirectUrl
        })

        res.json(result)

    } catch (error) {
        console.error("Could not start Connections:", error)

        res.status(500).json({
            error: "Could not start Connections."
        })
    }
})

connectionRouter.post("/refresh-status", async (req, res) => {
    try {
        const connection = await refreshCalendarConnection({
            userId: req.auth!.userId,
            authUserId: req.auth!.authUserId
        })

        res.json({ connection })

    } catch (error) {
        console.error("Failed to refresh the Status:", error)

        res.status(500).json({
            error: "Failed to refresh the Status."
        })
    }
})