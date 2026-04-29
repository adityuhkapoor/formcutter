import { NextResponse } from 'next/server'

const gone = () =>
  NextResponse.json(
    { error: 'Service discontinued. Formcutter was a hackathon project and is no longer in operation.' },
    { status: 410 },
  )

export const GET = gone
export const POST = gone
export const PUT = gone
export const PATCH = gone
export const DELETE = gone
