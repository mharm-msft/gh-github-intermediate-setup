# GitHub Intermediate - IssueOps Repository

This repository is used for the GitHub Intermediate training offering. It
includes automation to drive the creation and management of training deliveries.

## Prerequisites

- Node.js 22.9.0 (the version in [`.node-version`](./.node-version))
- A dedicated GitHub organization used only for the class
- The controlled
  [`mharm-msft/gh-github-intermediate-template`](https://github.com/mharm-msft/gh-github-intermediate-template)
  repository must remain configured as a template repository
- A GitHub personal access token with the following scopes:
  - `repo` (Full control of private repositories)
  - `admin:org` (Full control of orgs and teams, read and write org projects)
  - `delete_repo` (Delete repositories)

## Setup

1. Clone this repository to your local machine.
1. Install the dependencies:

   ```sh
   npm ci
   ```

1. Copy [`classroom.example.json`](./classroom.example.json) to
   `classroom.json`, then update it with the class information (see below).
   `classroom.json` is ignored by Git because it contains the participant
   roster.
1. Create an environment variable, `GITHUB_TOKEN`, with your GitHub personal
   access token. This can be done in your terminal:

   ```sh
   export GITHUB_TOKEN=your_token_here
   ```

   > [!NOTE]
   >
   > If you are using PowerShell on Windows, use a masked prompt and remove the
   > token from the environment after the command completes:
   >
   > ```powershell
   > $securePat = Read-Host "Short-lived GitHub PAT" -AsSecureString
   > $env:GITHUB_TOKEN = [Net.NetworkCredential]::new("", $securePat).Password
   > try {
   >   node .\dist\index.js create
   > } finally {
   >   Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
   > }
   > ```

> [!WARNING]
>
> Use a dedicated training organization. The class team receives administrator
> access to every generated repository. Closing the class deletes all
> roster-derived class repositories, removes non-administrator attendees from
> the organization, and deletes the class team.

## JSON File

The local `classroom.json` file is used to define the class and its
attendees/administrators. Before running any commands, you must update this file
with the following information:

```jsonc
{
  // The GitHub server to use. Defaults to github.com.
  "githubServer": "github.com",
  // The organization where the class will be hosted. This must be a GitHub
  // organization that you are an owner of.
  "organization": "organization-name",
  // The customer name. This is used to identify the class in the organization.
  "customerName": "Customer Name",
  // A short abbreviation for the customer name. This is used as part of the
  // class repository names.
  "customerAbbr": "CN",
  // The list of GitHub handles for class administrators. These users will be
  // added as maintainers to the class team and will have access to all
  // repositories.
  "administrators": ["admin"],
  // The list of GitHub handles for class attendees. These users will be added
  // as members to the class team and will have access to all repositories.
  "attendees": ["mona"],
  // Internal state maintained by the provisioner. Leave empty before create.
  "provisioned": [],
  "pending": []
}
```

> [!IMPORTANT]
>
> As you run various commands, the `classroom.json` file will be updated with
> the current state of the class. This includes the list of attendees and
> administrators and the internal provisioning manifest. Keep this file for the
> entire class lifecycle so retries and `close` operate on the exact persisted
> state.

If an add operation reports `Incomplete Repository Requires Cleanup`, inspect
the named repository before deleting it. The provisioner will not automatically
delete a repository left by a previous process. After deliberate cleanup, rerun
the same add command; its persisted `pending` state allows provisioning to
resume without losing the roster entry.

## Available Actions

### Create Class

This should be the first action you run. It is responsible for creating a new
classroom in the target organization.

```sh
node dist/index.js create
```

The following actions are performed:

1. Create a new team in the target organization
1. Adds all attendees to the team as members
1. Adds all admins to the team as maintainers
1. Creates a new repository for each attendee and administrator
1. Grants the team access to each created repository
1. Configures the labs for each repository

### Close Class

Once the class is complete, you can run this action to close the class.

```sh
node dist/index.js close
```

The following actions are performed:

1. Deletes the class repositories derived from the persisted roster
1. Removes all non-administrator users from the organization
1. Deletes the class team

> [!NOTE]
>
> Any administrator users will remain in the organization. If you need to remove
> them, this must be done manually.

### Add Attendee

If you need to add an attendee to the class, you can run this action.

```sh
node dist/index.js add-user <handle>
```

The following actions are performed:

1. Invites the user to the organization
1. Adds the user to the class team
1. Creates a new repository for the user
1. Grants the team access to the new repository
1. Configures the labs for the new repository

### Remove Attendee

If you need to remove an attendee from the class, you can run this action.

```sh
node dist/index.js remove-user <handle>
```

The following actions are performed:

1. Removes the user from the organization
1. Removes the user from the class team
1. Deletes the user's repository
1. Removes the team's access to the user's repository

### Add Admin

If you need to add an admin to the class, you can run this action.

```sh
node dist/index.js add-admin <handle>
```

The following actions are performed:

1. Invites the user to the organization
1. Adds the user as a maintainer to the class team
1. Creates a new repository for the user
1. Grants the team access to the new repository
1. Configures the labs for the new repository

### Remove Admin

If you need to remove an admin from the class, you can run this action.

```sh
node dist/index.js remove-admin <handle>
```

The following actions are performed:

1. Removes the user from the organization
1. Removes the user as a maintainer from the class team
1. Deletes the user's repository
1. Removes the team's access to the user's repository

> [!NOTE]
>
> Unlike the `close` action, this action **will** remove the administrator from
> the organization. You will not be able to remove yourself from the class!
