import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'
import type { Classroom } from '../types.js'

/**
 * Generates the team name for this class.
 *
 * @param classroom Classroom
 * @returns Team Name
 */
export function generateTeamName(classroom: Classroom): string {
  return `gh-int-${classroom.customerAbbr.toLowerCase()}`
}

/**
 * Checks if the team exists.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @returns True if Team Exists
 */
export async function exists(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<boolean> {
  try {
    await octokit.rest.teams.getByName({
      org: classroom.organization,
      team_slug: generateTeamName(classroom)
    })
  } catch (error: any) {
    if (error.status === 404) return false
  }

  return true
}

/**
 * Gets the team.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @returns Team Information
 */
export async function get(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<string> {
  const response = await octokit.rest.teams.getByName({
    org: classroom.organization,
    team_slug: generateTeamName(classroom)
  })

  return response.data.slug
}

/**
 * Creates the team for this class.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 */
export async function create(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info(`Creating Team: ${generateTeamName(classroom)}`)

  // Create the team. Add the class administrators as maintainers.
  await octokit.rest.teams.create({
    org: classroom.organization,
    name: generateTeamName(classroom),
    privacy: 'closed'
  })

  // Add the attendees to the team.
  for (const user of classroom.attendees)
    await addUser(octokit, classroom, user, 'member')

  // Add the administrators to the team.
  for (const user of classroom.administrators)
    await addUser(octokit, classroom, user, 'maintainer')
}

/**
 * Adds a member to the team.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @param hande GitHub Handle
 * @param role Role
 */
export async function addUser(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom,
  handle: string,
  role: 'member' | 'maintainer'
): Promise<void> {
  core.info(`\tAdding User to Class Team: ${handle} (${role})`)

  // Add the user to the team.
  await octokit.rest.teams.addOrUpdateMembershipForUserInOrg({
    org: classroom.organization,
    team_slug: generateTeamName(classroom),
    username: handle,
    role
  })
}

/**
 * Removes a member from the team.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @param handle GitHub Handle
 */
export async function removeUser(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom,
  handle: string
): Promise<void> {
  core.info(`Removing User from Class Team: ${handle}`)

  try {
    // Check if the user is a member (they must have accepted the invitation).
    const membership = await octokit.rest.teams.getMembershipForUserInOrg({
      org: classroom.organization,
      team_slug: generateTeamName(classroom),
      username: handle
    })

    // Remove the user from the team.
    if (membership.data.state === 'active')
      await octokit.rest.teams.removeMembershipForUserInOrg({
        org: classroom.organization,
        team_slug: generateTeamName(classroom),
        username: handle
      })
  } catch (error: any) {
    // If the user could not be found, they're not in the organization.
    /* istanbul ignore next */
    if (error.status !== 404) throw error
  }
}

/**
 * Deletes the team.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 */
export async function deleteTeam(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info(`Deleting Team: ${generateTeamName(classroom)}`)

  // If the team exists, delete it.
  if (await exists(octokit, classroom))
    await octokit.rest.teams.deleteInOrg({
      org: classroom.organization,
      team_slug: generateTeamName(classroom)
    })
}

/**
 * Gets the members of the team.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @returns Team Member Handles
 */
export async function getMembers(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<string[]> {
  // Get the members of the team.
  const response = await octokit.rest.teams.listMembersInOrg({
    org: classroom.organization,
    team_slug: generateTeamName(classroom)
  })

  return response.data.map((user) => user.login)
}
