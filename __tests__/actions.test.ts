import { jest } from '@jest/globals'
import * as core from '../__fixtures__/@actions/core.js'
import * as octokit from '../__fixtures__/@octokit/rest.js'
import { TEST_CLASSROOM } from '../__fixtures__/common.js'

jest.useFakeTimers()
jest.unstable_mockModule('@actions/core', () => core)
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

const repos_exists: jest.SpiedFunction<
  typeof import('../src/github/repos.js').exists
> = jest.fn()
const repos_create: jest.SpiedFunction<
  typeof import('../src/github/repos.js').create
> = jest.fn()
const repos_configure: jest.SpiedFunction<
  typeof import('../src/github/repos.js').configure
> = jest.fn()
const repos_generateRepoName: jest.SpiedFunction<
  typeof import('../src/github/repos.js').generateRepoName
> = jest.fn()
const repos_deleteRepositories: jest.SpiedFunction<
  typeof import('../src/github/repos.js').deleteRepositories
> = jest.fn()
const teams_exists: jest.SpiedFunction<
  typeof import('../src/github/teams.js').exists
> = jest.fn()
const teams_generateTeamName: jest.SpiedFunction<
  typeof import('../src/github/teams.js').generateTeamName
> = jest.fn()
const teams_create: jest.SpiedFunction<
  typeof import('../src/github/teams.js').create
> = jest.fn()
const teams_deleteTeam: jest.SpiedFunction<
  typeof import('../src/github/teams.js').deleteTeam
> = jest.fn()
const teams_addUser: jest.SpiedFunction<
  typeof import('../src/github/teams.js').addUser
> = jest.fn()
const teams_get: jest.SpiedFunction<
  typeof import('../src/github/teams.js').get
> = jest.fn()
const teams_removeUser: jest.SpiedFunction<
  typeof import('../src/github/teams.js').removeUser
> = jest.fn()
const users_isOrgMember: jest.SpiedFunction<
  typeof import('../src/github/users.js').isOrgMember
> = jest.fn()
const users_removeUsers: jest.SpiedFunction<
  typeof import('../src/github/users.js').removeUsers
> = jest.fn()

jest.unstable_mockModule('../src/github/repos.js', () => {
  return {
    exists: repos_exists,
    create: repos_create,
    configure: repos_configure,
    generateRepoName: repos_generateRepoName,
    deleteRepositories: repos_deleteRepositories
  }
})
jest.unstable_mockModule('../src/github/teams.js', () => {
  return {
    exists: teams_exists,
    generateTeamName: teams_generateTeamName,
    create: teams_create,
    deleteTeam: teams_deleteTeam,
    addUser: teams_addUser,
    get: teams_get,
    removeUser: teams_removeUser
  }
})
jest.unstable_mockModule('../src/github/users.js', () => {
  return {
    isOrgMember: users_isOrgMember,
    removeUsers: users_removeUsers
  }
})

const actions = await import('../src/actions.js')

const { Octokit } = await import('@octokit/rest')
const mocktokit = jest.mocked(new Octokit())

describe('actions', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('create()', () => {
    it('Throws if team exists', async () => {
      teams_exists.mockResolvedValueOnce(true)
      teams_generateTeamName.mockReturnValueOnce('gh-int-na1')

      try {
        await actions.createClass(mocktokit, TEST_CLASSROOM)

        jest.runAllTimers()
      } catch (error: any) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error.message).toBe('Team Already Exists: gh-int-na1')
      }
    })

    it('Throws if repo exists', async () => {
      teams_exists.mockResolvedValueOnce(false)
      repos_exists.mockResolvedValueOnce(true)
      repos_generateRepoName.mockReturnValueOnce('gh-int-na1-ncalteen-testuser')

      try {
        await actions.createClass(mocktokit, TEST_CLASSROOM)
      } catch (error: any) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error.message).toBe(
          'Repository Already Exists: gh-int-na1-ncalteen-testuser'
        )
      }
    })

    it('Creates a class', async () => {
      teams_exists.mockResolvedValueOnce(false)
      teams_create.mockResolvedValueOnce({
        slug: 'gh-int-na1-ncalteen-testuser'
      } as any)
      repos_exists.mockResolvedValueOnce(false)
      teams_generateTeamName.mockReturnValueOnce('gh-int-na1')
      repos_generateRepoName.mockReturnValueOnce('gh-int-na1-ncalteen-testuser')

      await actions.createClass(mocktokit, TEST_CLASSROOM)

      expect(teams_create).toHaveBeenCalled()
      expect(repos_create).toHaveBeenCalled()
    })
  })

  describe('close()', () => {
    it('Closes an open class', async () => {
      await actions.closeClass(mocktokit, TEST_CLASSROOM)

      expect(repos_deleteRepositories).toHaveBeenCalled()
      expect(users_removeUsers).toHaveBeenCalled()
      expect(teams_deleteTeam).toHaveBeenCalled()
    })

    it('Closes a closed class', async () => {
      await actions.closeClass(mocktokit, TEST_CLASSROOM)

      expect(repos_deleteRepositories).toHaveBeenCalled()
      expect(users_removeUsers).toHaveBeenCalled()
      expect(teams_deleteTeam).toHaveBeenCalled()
      expect(mocktokit.rest.issues.createComment).not.toHaveBeenCalled()
      expect(mocktokit.rest.issues.update).not.toHaveBeenCalled()
    })
  })

  describe('addUser()', () => {
    it('Adds a user', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        attendees: [...TEST_CLASSROOM.attendees],
        provisioned: [...TEST_CLASSROOM.provisioned],
        pending: [...TEST_CLASSROOM.pending]
      }

      await actions.addUser(mocktokit, classroom, 'handle')

      expect(teams_addUser).toHaveBeenCalled()
      expect(repos_create).toHaveBeenCalled()
      expect(repos_configure).toHaveBeenCalled()
      expect(classroom.provisioned).toContain('handle')
      expect(classroom.pending).not.toContain('handle')
    })

    it('Does not add an existing user', async () => {
      repos_exists.mockResolvedValueOnce(true)

      await actions.addUser(mocktokit, TEST_CLASSROOM, 'attendee1')

      expect(teams_addUser).not.toHaveBeenCalled()
      expect(repos_create).not.toHaveBeenCalled()
      expect(repos_configure).not.toHaveBeenCalled()
    })

    it('Records a user before repository configuration', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        attendees: [...TEST_CLASSROOM.attendees],
        provisioned: [...TEST_CLASSROOM.provisioned],
        pending: [...TEST_CLASSROOM.pending]
      }
      repos_exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      repos_create.mockResolvedValueOnce('gh-int-tc-new-attendee')
      repos_configure.mockRejectedValueOnce(new Error('Configuration failed'))

      await expect(
        actions.addUser(mocktokit, classroom, 'new-attendee')
      ).rejects.toThrow('Configuration failed')
      expect(classroom.attendees).toContain('new-attendee')
      expect(classroom.provisioned).not.toContain('new-attendee')
      expect(classroom.pending).toContain('new-attendee')
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: classroom.organization,
        repo: 'gh-int-tc-new-attendee'
      })
    })

    it('Refuses to delete an incomplete attendee repository on retry', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        attendees: [...TEST_CLASSROOM.attendees, 'partial-attendee'],
        provisioned: [...TEST_CLASSROOM.provisioned],
        pending: [...TEST_CLASSROOM.pending, 'partial-attendee']
      }
      repos_exists.mockResolvedValueOnce(true)
      await expect(
        actions.addUser(mocktokit, classroom, 'partial-attendee')
      ).rejects.toThrow(
        'Incomplete Repository Requires Cleanup: partial-attendee'
      )
      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
      expect(repos_create).not.toHaveBeenCalled()
      expect(repos_configure).not.toHaveBeenCalled()
    })

    it('Does not delete a rostered repository without a pending attempt', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        attendees: [...TEST_CLASSROOM.attendees, 'collision-attendee'],
        provisioned: [...TEST_CLASSROOM.provisioned],
        pending: [...TEST_CLASSROOM.pending]
      }
      repos_exists.mockResolvedValueOnce(true)

      await expect(
        actions.addUser(mocktokit, classroom, 'collision-attendee')
      ).rejects.toThrow('Repository Already Exists: collision-attendee')
      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
    })
  })

  describe('removeUser()', () => {
    it('Removes a user', async () => {
      users_isOrgMember.mockResolvedValueOnce('active')
      repos_exists.mockResolvedValueOnce(true)

      await actions.removeUser(mocktokit, TEST_CLASSROOM, 'attendee1')

      expect(mocktokit.rest.orgs.removeMember).toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).toHaveBeenCalled()
      expect(teams_removeUser).toHaveBeenCalled()
      expect(TEST_CLASSROOM.provisioned).not.toContain('attendee1')
    })

    it('Does not remove a user who is an administrator', async () => {
      await actions.removeUser(mocktokit, TEST_CLASSROOM, 'admin1')

      expect(mocktokit.rest.orgs.removeMember).not.toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
      expect(teams_removeUser).not.toHaveBeenCalled()
    })

    it('Does not remove a user who is not found in attendees', async () => {
      await actions.removeUser(mocktokit, TEST_CLASSROOM, 'nonexistent')

      expect(mocktokit.rest.orgs.removeMember).not.toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
      expect(teams_removeUser).not.toHaveBeenCalled()
    })

    it('Cancels pending invitation if user membership is pending', async () => {
      users_isOrgMember.mockResolvedValueOnce('pending')
      mocktokit.paginate.mockResolvedValueOnce([
        { login: 'attendee2', id: 123 }
      ])

      await actions.removeUser(mocktokit, TEST_CLASSROOM, 'attendee2')

      expect(mocktokit.rest.orgs.cancelInvitation).toHaveBeenCalled()
    })
  })

  describe('addAdmin()', () => {
    it('Adds an admin', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        administrators: [...TEST_CLASSROOM.administrators],
        provisioned: [...TEST_CLASSROOM.provisioned],
        pending: [...TEST_CLASSROOM.pending]
      }

      await actions.addAdmin(mocktokit, classroom, 'handle')

      expect(teams_addUser).toHaveBeenCalled()
      expect(repos_create).toHaveBeenCalled()
      expect(repos_configure).toHaveBeenCalled()
      expect(classroom.provisioned).toContain('handle')
      expect(classroom.pending).not.toContain('handle')
    })

    it('Promotes a provisioned attendee without recreating the repository', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        attendees: [...TEST_CLASSROOM.attendees, 'promoted-user'],
        administrators: [...TEST_CLASSROOM.administrators],
        provisioned: [...TEST_CLASSROOM.provisioned, 'promoted-user'],
        pending: [...TEST_CLASSROOM.pending]
      }
      repos_exists.mockResolvedValueOnce(true)

      await actions.addAdmin(mocktokit, classroom, 'promoted-user')

      expect(teams_addUser).toHaveBeenCalledWith(
        mocktokit,
        classroom,
        'promoted-user',
        'maintainer'
      )
      expect(repos_create).not.toHaveBeenCalled()
      expect(classroom.administrators).toContain('promoted-user')
    })

    it('Records an admin before repository configuration', async () => {
      const classroom = {
        ...TEST_CLASSROOM,
        administrators: [...TEST_CLASSROOM.administrators],
        provisioned: [...TEST_CLASSROOM.provisioned],
        pending: [...TEST_CLASSROOM.pending]
      }
      repos_exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      repos_create.mockResolvedValueOnce('gh-int-tc-new-admin')
      repos_configure.mockRejectedValueOnce(new Error('Configuration failed'))

      await expect(
        actions.addAdmin(mocktokit, classroom, 'new-admin')
      ).rejects.toThrow('Configuration failed')
      expect(classroom.administrators).toContain('new-admin')
      expect(classroom.provisioned).not.toContain('new-admin')
      expect(classroom.pending).toContain('new-admin')
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: classroom.organization,
        repo: 'gh-int-tc-new-admin'
      })
    })
  })

  describe('removeAdmin()', () => {
    beforeEach(() => {
      mocktokit.rest.users.getAuthenticated.mockResolvedValue({
        data: {
          login: 'authenticated'
        }
      } as any)
    })

    it('Removes an admin', async () => {
      users_isOrgMember.mockResolvedValueOnce('active')
      repos_exists.mockResolvedValueOnce(true)

      await actions.removeAdmin(mocktokit, TEST_CLASSROOM, 'admin1')

      expect(mocktokit.rest.orgs.removeMember).toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).toHaveBeenCalled()
      expect(teams_removeUser).toHaveBeenCalled()
      expect(TEST_CLASSROOM.provisioned).not.toContain('admin1')
    })

    it('Does not remove a user who is not found in administrators', async () => {
      await actions.removeAdmin(mocktokit, TEST_CLASSROOM, 'nonexistent')

      expect(mocktokit.rest.orgs.removeMember).not.toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
      expect(teams_removeUser).not.toHaveBeenCalled()
    })

    it('Does not remove yourself', async () => {
      TEST_CLASSROOM.administrators.push('authenticated')

      await actions.removeAdmin(mocktokit, TEST_CLASSROOM, 'authenticated')

      expect(mocktokit.rest.orgs.removeMember).not.toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
      expect(teams_removeUser).not.toHaveBeenCalled()
    })
  })
})
