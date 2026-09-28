# VIDZA AI Backend — Release Ready

This server keeps the Runway API key off the Android app.

## 1. Install
Node.js 20+ recommended.

    npm install

## 2. Configure the secret

Copy `.env.example` to `.env` and set:

    RUNWAYML_API_SECRET=YOUR_RUNWAY_KEY

Never commit `.env` and never put the key in the Android APK.

## 3. Start

    npm start

Health check:

    GET /api/health

Generate:

    POST /api/generate

Status:

    GET /api/status/:id

## Render

A `render.yaml` is included at the project root. In Render, create the service from this repository and add
`RUNWAYML_API_SECRET` as a secret environment variable.

Runway currently documents `gen4.5` image-to-video and the `RUNWAYML_API_SECRET` environment variable.
