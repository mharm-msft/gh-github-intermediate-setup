import * as core from '@actions/core'
import type { ExecOptions } from '@actions/exec'
import * as exec from '@actions/exec'
import { Octokit } from '@octokit/rest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Common } from '../enums.js'
import type { Classroom } from '../types.js'
import { generateTeamName } from './teams.js'

/**
 * Generates the repository name for this class and user.
 *
 * @param classroom Classroom
 * @param handle GitHub Handle
 */
export function generateRepoName(classroom: Classroom, handle: string): string {
  return `gh-int-${classroom.customerAbbr.toLowerCase()}-${handle}`
}

/**
 * Creates a repository for an attendee.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @param handle GitHub Handle
 * @returns Repository Name
 */
export async function create(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom,
  handle: string
): Promise<string> {
  core.info(`Creating Repository: ${generateRepoName(classroom, handle)}`)

  const response = await octokit.rest.repos.createUsingTemplate({
    template_owner: Common.TEMPLATE_OWNER,
    template_repo: Common.TEMPLATE_REPO,
    owner: classroom.organization,
    name: generateRepoName(classroom, handle),
    description: `GitHub Intermediate - ${classroom.customerName}`,
    include_all_branches: false,
    private: true
  })

  try {
    // Grant the team access to the repository.
    await octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
      org: classroom.organization,
      team_slug: generateTeamName(classroom),
      owner: classroom.organization,
      repo: response.data.name,
      permission: 'admin'
    })
  } catch (error) {
    try {
      await octokit.rest.repos.delete({
        owner: classroom.organization,
        repo: response.data.name
      })
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Failed to grant team access and clean up repository: ${response.data.name}`
      )
    }

    throw error
  }

  return response.data.name
}

/**
 * Checks if the repository exists.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @param handle GitHub Handle
 * @returns True if the Repository Exists
 */
export async function exists(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom,
  handle: string
): Promise<boolean> {
  try {
    await octokit.rest.repos.get({
      owner: classroom.organization,
      repo: generateRepoName(classroom, handle)
    })
  } catch (error: any) {
    if (error.status === 404) return false
    throw error
  }

  return true
}

/**
 * Configures an attendee repository.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 * @param repo Repository Name
 */
export async function configure(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom,
  repo: string
): Promise<void> {
  core.info(`Configuring Repository: ${repo}`)

  // Create the deployments environment.
  await octokit.rest.repos.createOrUpdateEnvironment({
    owner: classroom.organization,
    repo,
    environment_name: 'deployments'
  })

  // Configure GitHub Pages.
  const response = await octokit.rest.repos.createPagesSite({
    owner: classroom.organization,
    repo,
    build_type: 'workflow'
  })

  // Update the About page of the repo to include the URL.
  await octokit.rest.repos.update({
    owner: classroom.organization,
    repo,
    homepage: response.data.html_url
  })

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-int-'))

  // Configure the exec options.
  const options: exec.ExecOptions = {
    cwd: tempRoot,
    listeners: {
      stdout: (data: Buffer) => {},
      stderr: (data: Buffer) => {
        /* istanbul ignore next */
        if (
          !data.toString().startsWith('Cloning into') &&
          !data.toString().startsWith('To https://') &&
          !data.toString().startsWith('Switched to') &&
          !data.toString().startsWith('Already on') &&
          !data.toString().startsWith('remote:')
        )
          console.error(`\t${data.toString()}`)
      }
    },
    silent: true
  }

  let configurationError: unknown
  try {
    // Clone into an operation-owned temporary directory.
    await exec.exec(
      'git',
      [
        'clone',
        `https://x-access-token:${process.env.GITHUB_TOKEN!}@${classroom.githubServer}/${classroom.organization}/${repo}.git`
      ],
      options
    )

    // Update the working directory to the checked out repository.
    options.cwd = path.join(tempRoot, repo)

    // Update the remote URL to use the token.
    await exec.exec(
      'git',
      [
        'remote',
        'set-url',
        'origin',
        `https://x-access-token:${process.env.GITHUB_TOKEN!}@${classroom.githubServer}/${classroom.organization}/${repo}.git`
      ],
      options
    )

    // Configure the labs.
    await configureLab1(options, octokit, classroom)
    await configureLab2(options, octokit, classroom)
    await configureLab3(options, octokit, classroom)
    await configureLab4(options, octokit, classroom)
    await configureLab5(options, octokit, classroom)
    await configureLab6(options, octokit, classroom)
    await configureLab7(options, octokit, classroom)
    await configureLab8(options, octokit, classroom, repo)
    await configureLab9(options, octokit, classroom)
    await configureLab10(options, octokit, classroom)
    await configureLab11(options, octokit, classroom)
  } catch (error) {
    configurationError = error
  }

  let cleanupError: unknown
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  } catch (error) {
    cleanupError = error
  }

  if (configurationError) {
    if (cleanupError)
      throw new AggregateError(
        [configurationError, cleanupError],
        `Failed to configure repository and remove temporary directory: ${repo}`
      )
    throw configurationError
  }

  if (cleanupError) {
    const message =
      cleanupError instanceof Error
        ? cleanupError.message
        : String(cleanupError)
    core.warning(`Temporary directory cleanup failed: ${message}`)
  }
}

/**
 * Deletes all class repositories.
 *
 * @param octokit Octokit
 * @param classroom Classroom
 */
export async function deleteRepositories(
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info(`Deleting Repositories: ${classroom.customerAbbr}`)

  const handles = [
    ...new Set([...classroom.attendees, ...classroom.administrators])
  ]

  // Delete only repositories derived from the persisted class roster.
  for (const handle of handles) {
    if (!(await exists(octokit, classroom, handle))) continue

    const repo = generateRepoName(classroom, handle)
    core.info(`\tDeleting Repository: ${repo}`)

    await octokit.rest.repos.delete({
      owner: classroom.organization,
      repo
    })
  }
}

/**
 * Configure Lab 1: Add a Feature
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab1(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 1: Add a Feature')

  // Nothing needs to be done...
}

/**
 * Configure Lab 2: Add Tags
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab2(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 2: Add Tags')

  // Nothing needs to be done...
}

/**
 * Configure Lab 3: Git Bisect
 *
 * This setup step creates a number of commits in the lab repository. One commit
 * will contain the specific code that the student will need to bisect to find.
 * The remainder are just filler commits to make the history more complex.
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab3(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 3: Git Bisect')

  for (let i = 1; i < 10; i++) {
    // Get the file contents.
    const filename = `keyboard_input_manager.test.${i}`
    const contents = fs.readFileSync(
      `${process.cwd()}/lab-files/3-git-bisect/${filename}`,
      'utf8'
    )

    // Remove the old file if it exists.
    fs.rmSync(
      path.join(
        options.cwd as string,
        '__tests__',
        'keyboard_input_manager.test.ts'
      ),
      { force: true }
    )

    // Write the new file.
    fs.writeFileSync(
      `${options.cwd}/__tests__/keyboard_input_manager.test.ts`,
      contents,
      'utf8'
    )

    // Commit the changes.
    await exec.exec('git', ['add', '.'], options)
    await exec.exec('git', ['commit', '-m', `Adding unit tests ${i}`], options)
  }

  await exec.exec('git', ['push'], options)
  await exec.exec('git', ['checkout', 'main'], options)
}

/**
 * Configure Lab 4: Interactive Rebase
 *
 * This setup step creates a feature branch off an earlier commit on main, so
 * that students can rebase the feature branch onto the latest commit on main.
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab4(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 4: Interactive Rebase')

  // Get the file contents.
  const contents = fs.readFileSync(
    `${process.cwd()}/lab-files/4-interactive-rebase/html_actuator.1`,
    'utf8'
  )

  // After the lab 3 configuration runs, there should be ~10 commits on main.
  // Get the fifth previous commit SHA.
  const response = await exec.getExecOutput(
    'git',
    ['rev-parse', 'HEAD~5'],
    options
  )
  const sha = response.stdout?.trim()

  // Checkout a feature branch at the SHA.
  await exec.exec(
    'git',
    ['checkout', '-b', 'feature/animate-score', sha],
    options
  )

  // Remove the old file if it exists.
  fs.rmSync(path.join(options.cwd as string, 'src', 'html_actuator.ts'), {
    force: true
  })

  // Write the new file.
  fs.writeFileSync(`${options.cwd}/src/html_actuator.ts`, contents, 'utf8')

  // Commit the changes.
  await exec.exec('git', ['add', '.'], options)
  await exec.exec('git', ['commit', '-m', 'Animate score update'], options)
  await exec.exec(
    'git',
    ['push', '--set-upstream', 'origin', 'feature/animate-score'],
    options
  )
  await exec.exec('git', ['checkout', 'main'], options)
}

/**
 * Configure Lab 5: Cherry-Pick
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab5(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 5: Cherry-Pick')

  // Nothing needs to be done...
}

/**
 * Configure Lab 6: Protect Main
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab6(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 6: Protect Main')

  const labPath = path.join(options.cwd as string, 'labs', '6-protect-main.md')
  const codeOwnerMarker = '@<organization>/<class-team>'
  const classCodeOwner = `@${classroom.organization}/${generateTeamName(classroom)}`
  const contents = fs.readFileSync(labPath, 'utf8')

  if (!contents.includes(codeOwnerMarker))
    throw new Error(`Lab 6 code owner marker not found: ${codeOwnerMarker}`)

  fs.writeFileSync(
    labPath,
    contents.replaceAll(codeOwnerMarker, classCodeOwner),
    'utf8'
  )
  await exec.exec('git', ['add', 'labs/6-protect-main.md'], options)
  await exec.exec(
    'git',
    ['commit', '-m', 'Configure class team as code owner'],
    options
  )
  await exec.exec('git', ['push'], options)
}

/**
 * Configure Lab 7: GitHub Flow
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab7(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 7: GitHub Flow')

  // Nothing needs to be done...
}

/**
 * Configure Lab 8: Merge Conflicts
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab8(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom,
  repo: string
): Promise<void> {
  core.info('\tConfiguring Lab 8: Merge Conflicts')

  // Create the PRs for the first merge conflict to resolve.
  for (let i = 1; i < 3; i++) {
    // Get the file contents.
    const filename = `game_manager.${i}`
    const contents = fs.readFileSync(
      `${process.cwd()}/lab-files/8-merge-conflicts/${filename}`,
      'utf8'
    )

    // Checkout a feature branch.
    await exec.exec(
      'git',
      ['checkout', '-b', `feature/tile-value-${i}`],
      options
    )

    // Remove the old file if it exists.
    fs.rmSync(path.join(options.cwd as string, 'src', 'game_manager.ts'), {
      force: true
    })

    // Write the new file.
    fs.writeFileSync(`${options.cwd}/src/game_manager.ts`, contents, 'utf8')

    // Commit the changes.
    await exec.exec('git', ['add', '.'], options)
    await exec.exec(
      'git',
      ['commit', '-m', `Increase rate of tiles with value 4`],
      options
    )

    // Push the changes.
    await exec.exec(
      'git',
      ['push', '--set-upstream', 'origin', `feature/tile-value-${i}`],
      options
    )
    await exec.exec('git', ['checkout', 'main'], options)

    // Create the pull request.
    await octokit.rest.pulls.create({
      owner: classroom.organization,
      repo,
      head: `feature/tile-value-${i}`,
      base: 'main',
      title: 'Increase rate of tiles with value 4',
      body: 'This PR increases the rate at which random tiles are created with a value of 4, making the game easier.'
    })
  }

  // Create the PRs for the second merge conflict to resolve.
  for (let i = 3; i < 5; i++) {
    // Get the file contents.
    const filename = `game_manager.${i}`
    const contents = fs.readFileSync(
      `${process.cwd()}/lab-files/8-merge-conflicts/${filename}`,
      'utf8'
    )

    // Checkout a feature branch.
    await exec.exec(
      'git',
      ['checkout', '-b', `feature/start-tiles-${i}`],
      options
    )

    // Remove the old file if it exists.
    fs.rmSync(path.join(options.cwd as string, 'src', 'game_manager.ts'), {
      force: true
    })

    // Write the new file.
    fs.writeFileSync(`${options.cwd}/src/game_manager.ts`, contents, 'utf8')

    // Commit the changes.
    await exec.exec('git', ['add', '.'], options)
    await exec.exec(
      'git',
      ['commit', '-m', `Increase the number of starting tiles`],
      options
    )

    // Push the changes.
    await exec.exec(
      'git',
      ['push', '--set-upstream', 'origin', `feature/start-tiles-${i}`],
      options
    )
    await exec.exec('git', ['checkout', 'main'], options)

    // Create the pull request.
    await octokit.rest.pulls.create({
      owner: classroom.organization,
      repo,
      head: `feature/start-tiles-${i}`,
      base: 'main',
      title: 'Increase the number of starting tiles',
      body: 'This PR increases the number of starting tiles in new games, so that players can get started quickly.'
    })
  }
}

/**
 * Configure Lab 9: Run a Workflow
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab9(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 9: Run a Workflow')

  // Nothing needs to be done...
}

/**
 * Configure Lab 10: Create a Release
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab10(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 10: Create a Release')

  // Nothing needs to be done...
}

/**
 * Configure Lab 11: Deploy to an Environment
 *
 * @param options Exec Options
 * @param octokit Octokit Client
 * @param classroom Classroom
 */
export async function configureLab11(
  options: ExecOptions,
  octokit: InstanceType<typeof Octokit>,
  classroom: Classroom
): Promise<void> {
  core.info('\tConfiguring Lab 11: Deploy to an Environment')

  // Nothing needs to be done...
}
