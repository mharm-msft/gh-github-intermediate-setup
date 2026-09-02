import { jest } from '@jest/globals'
import * as core from '../__fixtures__/@actions/core.js'
import { TEST_CLASSROOM } from '../__fixtures__/common.js'
import fs from '../__fixtures__/fs.js'
import { AllowedAction } from '../src/enums.js'
import path from 'path'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('fs', () => fs)

const inputs = await import('../src/inputs.js')

describe('inputs.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getInputs()', () => {
    let originalArgv: string[]

    beforeEach(() => {
      originalArgv = process.argv
      process.argv = [...originalArgv]
    })

    afterEach(() => {
      process.argv = originalArgv
    })

    it('Should return undefined if no action is specified', () => {
      process.argv = ['node', 'dist/index.js']

      const result = inputs.getInputs()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if an invalid action is specified', () => {
      process.argv = ['node', 'dist/index.js', 'invalid-action']

      const result = inputs.getInputs()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if handle is missing for actions requiring it', () => {
      process.argv = ['node', 'dist/index.js', AllowedAction.ADD_USER]

      const result = inputs.getInputs()

      expect(result).toBeUndefined()
    })

    it('Should return valid inputs for a valid action and handle', () => {
      process.argv = [
        'node',
        'dist/index.js',
        AllowedAction.ADD_USER,
        'test-handle'
      ]

      const result = inputs.getInputs()

      expect(result).toEqual({
        action: AllowedAction.ADD_USER,
        handle: 'test-handle'
      })
    })
  })

  describe('getClassroom()', () => {
    it('Returns undefined if the classroom file does not exist', () => {
      fs.existsSync.mockReturnValue(false)

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if the classroom file is not valid JSON', () => {
      fs.readFileSync.mockReturnValue('Invalid JSON')

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if organization missing', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...TEST_CLASSROOM, organization: undefined })
      )

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if customerName missing', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...TEST_CLASSROOM, customerName: undefined })
      )

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if customerAbbr missing', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...TEST_CLASSROOM, customerAbbr: undefined })
      )

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if administrators missing', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...TEST_CLASSROOM, administrators: undefined })
      )

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if administrators empty', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...TEST_CLASSROOM, administrators: [] })
      )

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('Should return undefined if attendees missing', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...TEST_CLASSROOM, attendees: undefined })
      )

      const result = inputs.getClassroom()

      expect(result).toBeUndefined()
    })

    it('should return a valid classroom object if the file is valid', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(JSON.stringify(TEST_CLASSROOM))

      const result = inputs.getClassroom()

      expect(result).toMatchObject(TEST_CLASSROOM)
    })

    it('Treats a legacy roster as provisioned when state is missing', () => {
      const legacyClassroom = {
        ...TEST_CLASSROOM,
        provisioned: undefined,
        pending: undefined
      }
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(JSON.stringify(legacyClassroom))

      const result = inputs.getClassroom()

      expect(result?.provisioned).toEqual([
        'admin1',
        'attendee1',
        'attendee2',
        'admin2'
      ])
      expect(result?.pending).toEqual([])
    })
  })

  describe('updateClassroom()', () => {
    it('Updates the classroom data', () => {
      inputs.updateClassroom(TEST_CLASSROOM)

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.resolve(process.cwd(), 'classroom.json'),
        JSON.stringify(TEST_CLASSROOM, null, 2),
        'utf8'
      )
    })
  })
})
