import * as core from '@actions/core'
import * as fs from 'fs'
import path from 'path'
import { AllowedAction } from './enums.js'
import type { ActionInputs, Classroom } from './types.js'

/**
 * Gets and validates the command-line inputs.
 *
 * Command format:
 *
 * `node dist/index.js <action>`
 *
 * @returns Action Inputs
 */
export function getInputs(): ActionInputs | undefined {
  const action = process.argv[2]

  // Check if the action is present.
  if (!action) {
    core.error('No Action Input Specified')
    return undefined
  }

  const inputs: ActionInputs = {
    action: action as AllowedAction
  }

  // Check if the action is valid.
  if (
    Object.values(AllowedAction).includes(action as AllowedAction) === false
  ) {
    core.error(
      `Invalid Action Input (Options: ${Object.values(AllowedAction).join(', ')})`
    )
    return undefined
  }

  // If the action is `add-user`, check if the handle is present.
  if (
    /* istanbul ignore next */
    action === AllowedAction.ADD_USER ||
    action === AllowedAction.REMOVE_USER ||
    action === AllowedAction.ADD_ADMIN ||
    action === AllowedAction.REMOVE_ADMIN
  ) {
    const handle = process.argv[3]

    if (!handle) {
      core.error('No Handle Input Specified')
      core.error(`Usage: node dist/index.js ${action} <handle>`)
      return undefined
    }

    inputs.handle = handle
  }

  return inputs
}

/**
 * Gets and validates the classroom JSON file.
 *
 * @returns Classroom JSON
 */
export function getClassroom(): Classroom | undefined {
  // Check if the file exists.
  if (!fs.existsSync(path.resolve(process.cwd(), 'classroom.json'))) {
    core.error('Classroom File Not Found')
    return undefined
  }

  // Read the file.
  const classroomFile = fs.readFileSync(
    path.resolve(process.cwd(), 'classroom.json'),
    'utf8'
  )

  // Try to parse the file.
  try {
    const parsedFile = JSON.parse(classroomFile) as Classroom

    // Check if the required fields are present.
    if (parsedFile.organization === undefined) {
      core.error('Classroom File Missing Organization Field')
      return undefined
    }
    if (parsedFile.customerName === undefined) {
      core.error('Classroom File Missing Customer Name Field')
      return undefined
    }
    if (parsedFile.customerAbbr === undefined) {
      core.error('Classroom File Missing Customer Abbreviation Field')
      return undefined
    }
    if (parsedFile.administrators === undefined) {
      core.error('Classroom File Missing Administrators Field')
      return undefined
    }
    if (parsedFile.administrators.length === 0) {
      core.error('Classroom File Missing Administrators')
      return undefined
    }
    if (parsedFile.attendees === undefined) {
      core.error('Classroom File Missing Attendees Field')
      return undefined
    }

    // Validate the organization matches GitHub org slug conventions.
    if (!/^[a-zA-Z0-9-_]+$/.test(parsedFile.organization)) {
      core.error(
        'Organization Field Invalid (Only Alphanumeric, Hyphen, Underscore)'
      )
      return undefined
    }

    const administrators = parsedFile.administrators.map((admin: string) =>
      admin.trim()
    )
    const attendees = parsedFile.attendees.map((attendee: string) =>
      attendee.trim()
    )
    const provisioned =
      parsedFile.provisioned === undefined
        ? [...new Set([...attendees, ...administrators])]
        : parsedFile.provisioned.map((handle: string) => handle.trim())
    const pending = (parsedFile.pending ?? []).map((handle: string) =>
      handle.trim()
    )

    return {
      githubServer:
        /* istanbul ignore next */ parsedFile.githubServer?.trim() ||
        'github.com',
      organization: parsedFile.organization.trim(),
      customerName: parsedFile.customerName.trim(),
      customerAbbr: parsedFile.customerAbbr.trim().toUpperCase(),
      administrators,
      attendees,
      provisioned,
      pending
    }
  } catch (error) {
    /* istanbul ignore next */
    core.error('Classroom File Not Valid JSON')
  }

  /* istanbul ignore next */
  return undefined
}

/**
 * Updates the classroom JSON file.
 *
 * @param classroom Classroom
 */
export function updateClassroom(classroom: Classroom): void {
  fs.writeFileSync(
    path.resolve(process.cwd(), 'classroom.json'),
    JSON.stringify(classroom, null, 2),
    'utf8'
  )
}
