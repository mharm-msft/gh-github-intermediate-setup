import { jest } from '@jest/globals'
import * as core from '../../__fixtures__/@actions/core.js'
import * as exec from '../../__fixtures__/@actions/exec.js'
import * as octokit from '../../__fixtures__/@octokit/rest.js'
import { TEST_CLASSROOM } from '../../__fixtures__/common.js'
import * as fs from '../../__fixtures__/fs.js'

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
jest.unstable_mockModule('fs', () => fs)

const generateTeamName: jest.SpiedFunction<
  typeof import('../../src/github/teams.js').generateTeamName
> = jest.fn()
const getMembers: jest.SpiedFunction<
  typeof import('../../src/github/teams.js').getMembers
> = jest.fn()

jest.unstable_mockModule('../../src/github/teams.js', () => ({
  generateTeamName,
  getMembers
}))

const repos = await import('../../src/github/repos.js')

const { Octokit } = await import('@octokit/rest')
const mocktokit = jest.mocked(new Octokit())

describe('repos', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('generateRepoName()', () => {
    it('Generates a repo name', () => {
      expect(
        repos.generateRepoName(TEST_CLASSROOM, 'ncalteen-testuser')
      ).toEqual('gh-int-tc-ncalteen-testuser')
    })
  })

  describe('create()', () => {
    beforeEach(() => {
      mocktokit.rest.repos.createUsingTemplate.mockResolvedValue({
        data: {
          name: 'repo-name'
        }
      } as any)
    })

    it('Creates a repo', async () => {
      await repos.create(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')

      expect(mocktokit.rest.repos.createUsingTemplate).toHaveBeenCalledWith({
        template_owner: 'mharm-msft',
        template_repo: 'gh-github-intermediate-template',
        owner: TEST_CLASSROOM.organization,
        name: 'gh-int-tc-ncalteen-testuser',
        description: `GitHub Intermediate - ${TEST_CLASSROOM.customerName}`,
        include_all_branches: false,
        private: true
      })
      expect(
        mocktokit.rest.teams.addOrUpdateRepoPermissionsInOrg
      ).toHaveBeenCalled()
    })

    it('Deletes a new repository if team access fails', async () => {
      mocktokit.rest.teams.addOrUpdateRepoPermissionsInOrg.mockRejectedValueOnce(
        new Error('Permission failed')
      )

      await expect(
        repos.create(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')
      ).rejects.toThrow('Permission failed')
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: TEST_CLASSROOM.organization,
        repo: 'repo-name'
      })
    })
  })

  describe('exists()', () => {
    it('Returns true if a repo exists', async () => {
      mocktokit.rest.repos.get.mockResolvedValue({
        data: {
          name: 'repo-name'
        }
      } as any)

      expect(
        await repos.exists(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')
      ).toBe(true)
    })

    it('Returns false if a repo does not exist', async () => {
      mocktokit.rest.repos.get.mockRejectedValue({
        status: 404
      })

      expect(
        await repos.exists(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')
      ).toBe(false)
    })

    it('Rethrows repository lookup errors other than not found', async () => {
      mocktokit.rest.repos.get.mockRejectedValue({
        status: 403
      })

      await expect(
        repos.exists(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')
      ).rejects.toEqual({ status: 403 })
    })
  })

  describe('configure()', () => {
    beforeEach(() => {
      mocktokit.rest.repos.createPagesSite.mockResolvedValue({
        data: {
          html_url: 'pages-url'
        }
      } as any)
      fs.mkdtempSync.mockReturnValue('temp-root')
      fs.readFileSync.mockReturnValue('@<organization>/<class-team>')
      generateTeamName.mockReturnValue('gh-int-tc')
      exec.getExecOutput.mockResolvedValue({
        stdout: 'stdout',
        stderr: 'stderr',
        exitCode: 0
      } as never)
    })

    it('Configures a repo', async () => {
      await repos.configure(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')

      expect(mocktokit.rest.repos.createOrUpdateEnvironment).toHaveBeenCalled()
      expect(mocktokit.rest.repos.createPagesSite).toHaveBeenCalled()
      expect(mocktokit.rest.repos.update).toHaveBeenCalled()
      expect(fs.rmSync).toHaveBeenCalledWith('temp-root', {
        recursive: true,
        force: true
      })
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('6-protect-main.md'),
        '@test-org/gh-int-tc',
        'utf8'
      )
      expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(4)
      for (const [input] of mocktokit.rest.pulls.create.mock.calls)
        expect(input.repo).toBe('ncalteen-testuser')
    })

    it('Fails if the learner template is missing the Lab 6 marker', async () => {
      fs.readFileSync.mockReturnValue('Lab 6 without a code owner marker')

      await expect(
        repos.configureLab6({ cwd: process.cwd() }, mocktokit, TEST_CLASSROOM)
      ).rejects.toThrow(
        'Lab 6 code owner marker not found: @<organization>/<class-team>'
      )
    })

    it('Keeps a configured repository when temporary cleanup fails', async () => {
      fs.rmSync.mockImplementation((target, options) => {
        if (target === 'temp-root' && options?.recursive)
          throw new Error('Directory is busy')
      })

      await expect(
        repos.configure(mocktokit, TEST_CLASSROOM, 'ncalteen-testuser')
      ).resolves.toBeUndefined()
      expect(core.warning).toHaveBeenCalledWith(
        'Temporary directory cleanup failed: Directory is busy'
      )
    })
  })

  describe('deleteRepositories()', () => {
    it('Deletes all class repositories', async () => {
      mocktokit.rest.repos.get.mockResolvedValue({ data: {} } as any)

      await repos.deleteRepositories(mocktokit, TEST_CLASSROOM)

      expect(mocktokit.rest.search.repos).not.toHaveBeenCalled()
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledTimes(4)
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: TEST_CLASSROOM.organization,
        repo: 'gh-int-tc-admin1'
      })
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: TEST_CLASSROOM.organization,
        repo: 'gh-int-tc-admin2'
      })
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: TEST_CLASSROOM.organization,
        repo: 'gh-int-tc-attendee1'
      })
      expect(mocktokit.rest.repos.delete).toHaveBeenCalledWith({
        owner: TEST_CLASSROOM.organization,
        repo: 'gh-int-tc-attendee2'
      })
    })

    it('Handles no repositories found gracefully', async () => {
      mocktokit.rest.repos.get.mockRejectedValue({ status: 404 })

      await repos.deleteRepositories(mocktokit, TEST_CLASSROOM)

      expect(mocktokit.rest.repos.delete).not.toHaveBeenCalled()
    })
  })
})
