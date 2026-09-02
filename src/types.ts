import { AllowedAction } from './enums.js'

/** Action Inputs */
export type ActionInputs = {
  /** Action */
  action: AllowedAction
  /** GitHub Handle */
  handle?: string
}

/** Classroom */
export type Classroom = {
  /** GitHub Server URL */
  githubServer: string
  /** GitHub Organization */
  organization: string
  /** Customer Name */
  customerName: string
  /** Customer Abbreviation */
  customerAbbr: string
  /** Administrators */
  administrators: string[]
  /** Attendees */
  attendees: string[]
  /** Successfully provisioned users and administrators */
  provisioned: string[]
  /** Users and administrators with incomplete provisioning attempts */
  pending: string[]
}
