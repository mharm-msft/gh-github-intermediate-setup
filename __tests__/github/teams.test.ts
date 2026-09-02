import { jest } from '@jest/globals'
import * as core from '../../__fixtures__/@actions/core.js'
import * as exec from '../../__fixtures__/@actions/exec.js'
import * as octokit from '../../__fixtures__/@octokit/rest.js'
import { TEST_CLASSROOM } from '../../__fixtures__/common.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/exec', () => exec)
jest.unstable_mockModule('@octokit/rest', async () => {
  class Octokit {
    constructor() {
      return octokit
    }
  }

  return {
    Octokit
  }
})

const teams = await import('../../src/github/teams.js')

const { Octokit } = await import('@octokit/rest')
const mocktokit = jest.mocked(new Octokit())

describe('teams', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('generateTeamName()', () => {
    it('Generates a team name', () => {
      expect(teams.generateTeamName(TEST_CLASSROOM)).toEqual('gh-int-tc')
    })
  })

  describe('exists()', () => {
    it('Returns true if a team exists', async () => {
      mocktokit.rest.teams.getByName.mockResolvedValue({
        data: {
          slug: 'gh-int-tc'
        }
      } as any)

      expect(await teams.exists(mocktokit, TEST_CLASSROOM)).toBe(true)
    })

    it('Returns false if a team does not exist', async () => {
      mocktokit.rest.teams.getByName.mockRejectedValue({
        status: 404
      } as any)

      expect(await teams.exists(mocktokit, TEST_CLASSROOM)).toBe(false)
    })
  })

  describe('get()', () => {
    it('Gets a team', async () => {
      mocktokit.rest.teams.getByName.mockResolvedValue({
        data: {
          slug: 'gh-int-tc'
        }
      } as any)

      expect(await teams.get(mocktokit, TEST_CLASSROOM)).toEqual('gh-int-tc')
    })
  })

  describe('create()', () => {
    beforeEach(() => {
      mocktokit.rest.teams.create.mockResolvedValue({
        data: {
          slug: 'gh-int-tc'
        }
      } as any)
    })

    it('Creates a team', async () => {
      await teams.create(mocktokit, TEST_CLASSROOM)

      expect(mocktokit.rest.teams.create).toHaveBeenCalledWith({
        org: TEST_CLASSROOM.organization,
        name: 'gh-int-tc',
        privacy: 'closed'
      })
      expect(
        mocktokit.rest.teams.addOrUpdateMembershipForUserInOrg
      ).toHaveBeenCalledTimes(5)
    })
  })

  describe('addUser()', () => {
    it('Adds a user', async () => {
      await teams.addUser(
        mocktokit,
        TEST_CLASSROOM,
        'ncalteen-testuser',
        'maintainer'
      )

      expect(
        mocktokit.rest.teams.addOrUpdateMembershipForUserInOrg
      ).toHaveBeenCalled()
    })
  })

  describe('removeUser()', () => {
    it('Removes a user', async () => {
      mocktokit.rest.teams.getMembershipForUserInOrg.mockResolvedValue({
        data: {
          state: 'active'
        }
      } as any)

      await teams.removeUser(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')

      expect(
        mocktokit.rest.teams.removeMembershipForUserInOrg
      ).toHaveBeenCalled()
    })
  })

  describe('deleteTeam()', () => {
    it('Deletes a team', async () => {
      await teams.deleteTeam(mocktokit, TEST_CLASSROOM)

      expect(mocktokit.rest.teams.deleteInOrg).toHaveBeenCalled()
    })
  })

  describe('getMembers()', () => {
    it('Gets members', async () => {
      mocktokit.rest.teams.listMembersInOrg.mockResolvedValue({
        data: [
          {
            login: 'ncalteen',
            email: 'ncalteen@github.com'
          }
        ]
      } as any)

      expect(await teams.getMembers(mocktokit, TEST_CLASSROOM)).toMatchObject([
        'ncalteen'
      ])

      expect(mocktokit.rest.teams.listMembersInOrg).toHaveBeenCalled()
    })
  })
})
