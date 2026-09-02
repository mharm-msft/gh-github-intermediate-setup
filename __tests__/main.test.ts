import { jest } from '@jest/globals'
import * as core from '../__fixtures__/@actions/core.js'
import { AllowedAction } from '../src/enums.js'
import { Classroom } from '../src/types.js'

jest.unstable_mockModule('@actions/core', () => core)

const getInputs: jest.SpiedFunction<
  typeof import('../src/inputs.js').getInputs
> = jest.fn()
const getClassroom: jest.SpiedFunction<
  typeof import('../src/inputs.js').getClassroom
> = jest.fn()
const updateClassroom: jest.SpiedFunction<
  typeof import('../src/inputs.js').updateClassroom
> = jest.fn()
const createClass: jest.SpiedFunction<
  typeof import('../src/actions.js').createClass
> = jest.fn()
const closeClass: jest.SpiedFunction<
  typeof import('../src/actions.js').closeClass
> = jest.fn()
const addUser: jest.SpiedFunction<typeof import('../src/actions.js').addUser> =
  jest.fn()
const removeUser: jest.SpiedFunction<
  typeof import('../src/actions.js').removeUser
> = jest.fn()
const addAdmin: jest.SpiedFunction<
  typeof import('../src/actions.js').addAdmin
> = jest.fn()
const removeAdmin: jest.SpiedFunction<
  typeof import('../src/actions.js').removeAdmin
> = jest.fn()

jest.unstable_mockModule('../src/inputs.js', () => ({
  getInputs,
  getClassroom,
  updateClassroom
}))
jest.unstable_mockModule('../src/actions.js', () => ({
  createClass,
  closeClass,
  addUser,
  removeUser,
  addAdmin,
  removeAdmin
}))

const main = await import('../src/main.js')
const classroom: Classroom = {
  githubServer: 'github.com',
  organization: 'test-org',
  customerName: 'Test Customer',
  customerAbbr: 'TC',
  attendees: [],
  administrators: [],
  provisioned: [],
  pending: []
}

describe('main', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'MY_TOKEN'
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Fails if the GITHUB_TOKEN is not present', async () => {
    delete process.env.GITHUB_TOKEN

    await main.run()

    expect(core.error).toHaveBeenCalledWith(
      'GITHUB_TOKEN Environment Variable Not Set'
    )
  })

  it('Fails if the inputs are not present', async () => {
    getInputs.mockReturnValue(undefined)

    await main.run()

    expect(createClass).not.toHaveBeenCalled()
    expect(closeClass).not.toHaveBeenCalled()
    expect(addUser).not.toHaveBeenCalled()
    expect(removeUser).not.toHaveBeenCalled()
    expect(addAdmin).not.toHaveBeenCalled()
    expect(removeAdmin).not.toHaveBeenCalled()
  })

  it('Fails if the classroom is not present', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.CREATE
    })
    getClassroom.mockReturnValue(undefined)

    await main.run()

    expect(createClass).not.toHaveBeenCalled()
    expect(closeClass).not.toHaveBeenCalled()
    expect(addUser).not.toHaveBeenCalled()
    expect(removeUser).not.toHaveBeenCalled()
    expect(addAdmin).not.toHaveBeenCalled()
    expect(removeAdmin).not.toHaveBeenCalled()
  })

  it('Processes the create action', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.CREATE
    })
    getClassroom.mockReturnValue(classroom)

    await main.run()

    expect(createClass).toHaveBeenCalled()
  })

  it('Processes the close action', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.CLOSE
    })
    getClassroom.mockReturnValue(classroom)

    await main.run()

    expect(closeClass).toHaveBeenCalled()
  })

  it('Processes the add user action', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.ADD_USER,
      handle: 'test'
    })
    getClassroom.mockReturnValue(classroom)

    await main.run()

    expect(addUser).toHaveBeenCalledWith(expect.anything(), classroom, 'test')
  })

  it('Processes the remove user action', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.REMOVE_USER,
      handle: 'test'
    })
    getClassroom.mockReturnValue(classroom)

    await main.run()

    expect(removeUser).toHaveBeenCalledWith(
      expect.anything(),
      classroom,
      'test'
    )
  })

  it('Processes the add admin action', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.ADD_ADMIN,
      handle: 'test'
    })
    getClassroom.mockReturnValue(classroom)

    await main.run()

    expect(addAdmin).toHaveBeenCalledWith(expect.anything(), classroom, 'test')
  })

  it('Processes the remove admin action', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.REMOVE_ADMIN,
      handle: 'test'
    })
    getClassroom.mockReturnValue(classroom)

    await main.run()

    expect(removeAdmin).toHaveBeenCalledWith(
      expect.anything(),
      classroom,
      'test'
    )
  })

  it('Handles errors', async () => {
    getInputs.mockReturnValue({
      action: AllowedAction.CREATE
    })
    getClassroom.mockReturnValue(classroom)
    createClass.mockImplementation(() => {
      throw new Error('Test error')
    })

    await main.run()

    expect(core.error).toHaveBeenCalledWith(new Error('Test error'))
    expect(updateClassroom).toHaveBeenCalledWith(classroom)
  })
})
