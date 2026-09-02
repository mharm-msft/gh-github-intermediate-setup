import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'
import * as actions from './actions.js'
import { AllowedAction } from './enums.js'
import { getClassroom, getInputs, updateClassroom } from './inputs.js'

export async function run(): Promise<void> {
  // Check if the GITHUB_TOKEN environment variable is set.
  if (!process.env.GITHUB_TOKEN) {
    core.error('GITHUB_TOKEN Environment Variable Not Set')
    return
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN!,
    log: {
      debug: (message: string) => {},
      info: (message: string) => {},
      warn: (message: string) => {},
      error: (message: string) => {}
    }
  })

  // Get the command-line inputs. Exit if not present.
  const inputs = getInputs()
  if (!inputs) return

  // Get the classroom JSON file. Exit if not present.
  const classroom = getClassroom()
  if (!classroom) return

  try {
    core.info(`Processing Action: ${inputs.action}`)
    core.info('')

    if (inputs.action === AllowedAction.CREATE)
      await actions.createClass(octokit, classroom)
    else if (inputs.action === AllowedAction.CLOSE)
      await actions.closeClass(octokit, classroom)
    else if (inputs.action === AllowedAction.ADD_USER)
      await actions.addUser(octokit, classroom, inputs.handle!)
    else if (inputs.action === AllowedAction.REMOVE_USER)
      await actions.removeUser(octokit, classroom, inputs.handle!)
    else if (inputs.action === AllowedAction.ADD_ADMIN)
      await actions.addAdmin(octokit, classroom, inputs.handle!)
    else if (inputs.action === AllowedAction.REMOVE_ADMIN)
      await actions.removeAdmin(octokit, classroom, inputs.handle!)
  } catch (error: any) {
    core.error(error)
  } finally {
    updateClassroom(classroom)
  }
}
